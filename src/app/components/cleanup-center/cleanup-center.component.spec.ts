import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { CleanupCenterComponent } from './cleanup-center.component';
import { CleanupAnalyzerService } from '../../services/cleanup-analyzer.service';
import { CleanupSettingsService } from '../../services/cleanup-settings.service';
import { QuarantineService } from '../../services/quarantine.service';
import { BookmarksProviderService } from '../../services/bookmarks-provider.service';
import { BulkMutationCoordinatorService } from '../../services/bulk-mutation-coordinator.service';
import { TagsService } from '../../services/tags.service';
import { UsefulnessService } from '../../services/usefulness.service';
import { CleanupAnalysisResult, CleanupReason } from '../../services/cleanup.types';

describe('CleanupCenterComponent', () => {
  let fixture: ComponentFixture<CleanupCenterComponent>;
  let component: CleanupCenterComponent;
  const result = signal<CleanupAnalysisResult | null>(null);
  const tree = [{
    id: '0',
    title: 'root',
    children: [{
      id: '1',
      parentId: '0',
      title: 'Bookmarks Bar',
      children: [
        { id: 'a', parentId: '1', title: 'Alpha', url: 'https://example.com' },
        { id: 'b', parentId: '1', title: 'Beta', url: 'https://example.com' }
      ]
    }]
  }] as chrome.bookmarks.BookmarkTreeNode[];
  const bookmarkEvents = new Subject<unknown>();
  const analyzer = {
    result,
    analyzing: signal(false),
    error: signal<string | null>(null),
    analyzeCurrentLibrary: vi.fn(async () => result()!),
    scheduleCurrentLibraryAnalysis: vi.fn()
  };
  const settings = {
    settings: signal({ staleDays: 730 }),
    update: vi.fn((update: { staleDays: number }) => settings.settings.set(update))
  };
  const quarantine = {
    quarantine: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    purge: vi.fn().mockResolvedValue(undefined)
  };
  const provider = {
    onCreatedEvent$: bookmarkEvents,
    onRemovedEvent$: bookmarkEvents,
    onChangedEvent$: bookmarkEvents,
    onMovedEvent$: bookmarkEvents,
    getBookmarks: vi.fn().mockResolvedValue(tree)
  };
  const bulk = {
    progress: signal({
      operation: null,
      active: false,
      total: 0,
      completed: 0,
      failures: [],
      cancelled: false
    }),
    isActive: vi.fn().mockReturnValue(false),
    cancel: vi.fn()
  };
  const tags = { bookmarkTags: signal({}), getTagsForBookmark: vi.fn().mockReturnValue([]) };
  const usefulness = { bookmarkUsefulness: signal({}) };

  beforeEach(async () => {
    result.set(createResult());
    settings.settings.set({ staleDays: 730 });
    vi.clearAllMocks();
    analyzer.analyzeCurrentLibrary.mockImplementation(async () => result()!);
    await TestBed.configureTestingModule({
      imports: [CleanupCenterComponent],
      providers: [
        provideRouter([]),
        { provide: CleanupAnalyzerService, useValue: analyzer },
        { provide: CleanupSettingsService, useValue: settings },
        { provide: QuarantineService, useValue: quarantine },
        { provide: BookmarksProviderService, useValue: provider },
        { provide: BulkMutationCoordinatorService, useValue: bulk },
        { provide: TagsService, useValue: tags },
        { provide: UsefulnessService, useValue: usefulness }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(CleanupCenterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('renders every cleanup category and configurable stale threshold', () => {
    const categoryButtons = fixture.nativeElement.querySelectorAll('.finding-nav button');
    expect(categoryButtons).toHaveLength(9);
    expect(categoryButtons[0].textContent).toContain('Exact duplicate URLs');
    expect(categoryButtons[0].textContent).toContain('2');
    expect(fixture.nativeElement.querySelector('#stale-days').value).toBe('730');

    component.staleDays = 365;
    component.updateStaleThreshold();

    expect(settings.update).toHaveBeenCalledWith({ staleDays: 365 });
  });

  it('lets the reviewer change a keeper and quarantines only selected copies', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const group = result()!.exactDuplicateGroups[0];
    component.setKeeper(group, 'b');
    component.selectGroupCopies(group);

    await component.quarantineSelected();

    expect(quarantine.quarantine).toHaveBeenCalledWith(expect.objectContaining({
      actionReason: 'exact-duplicate',
      duplicateKeeperId: 'b',
      duplicateBookmarkIds: ['a', 'b'],
      items: [expect.objectContaining({ id: 'a' })]
    }));
  });

  it('requires confirmation before permanent purge', async () => {
    component.chooseView('quarantined');
    component.toggleSelected('trash-item', true);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    await component.purgeSelected();
    expect(quarantine.purge).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await component.purgeSelected();
    expect(quarantine.purge).toHaveBeenCalledWith(['trash-item']);
  });

  it('keeps rendered finding rows bounded for 10,000 results', () => {
    const findings = Array.from({ length: 10_000 }, (_, index) => ({
      nodeId: `item-${index}`,
      title: `Item ${index}`,
      url: `https://example.com/${index}`,
      matchedReasons: ['untagged'] as CleanupReason[],
      actionable: true
    }));
    result.set({
      ...createResult(),
      findings,
      counts: { ...createCounts(), untagged: 10_000 }
    });
    component.chooseView('untagged');
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.finding-row');
    expect(component.visibleFindings()).toHaveLength(10_000);
    expect(rows.length).toBeLessThan(100);
  });
});

function createResult(): CleanupAnalysisResult {
  return {
    requestId: 1,
    analyzedAt: 1,
    findings: [
      {
        nodeId: 'a',
        title: 'Alpha',
        url: 'https://example.com',
        matchedReasons: ['exact-duplicate'],
        actionable: true
      },
      {
        nodeId: 'b',
        title: 'Beta',
        url: 'https://example.com',
        matchedReasons: ['exact-duplicate'],
        actionable: true
      },
      {
        nodeId: 'trash-item',
        title: 'Trash item',
        url: 'https://trash.example',
        matchedReasons: ['quarantined'],
        actionable: false
      }
    ],
    exactDuplicateGroups: [{
      id: 'exact:one',
      kind: 'exact',
      normalizedUrl: 'https://example.com',
      bookmarkIds: ['a', 'b'],
      keeperId: 'a'
    }],
    probableDuplicateGroups: [],
    counts: { ...createCounts(), 'exact-duplicate': 2, quarantined: 1 },
    excludedNodeCount: 0
  };
}

function createCounts(): Record<CleanupReason, number> {
  return {
    'exact-duplicate': 0,
    'probable-duplicate': 0,
    stale: 0,
    'unknown-usage': 0,
    untagged: 0,
    unrated: 0,
    'low-usefulness': 0,
    'empty-folder': 0,
    quarantined: 0
  };
}
