import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { BookmarkDetailComponent } from './bookmark-detail.component';
import { BookmarksFacadeService } from '../../services/bookmarks-facade.service';
import { TagsService } from '../../services/tags.service';
import { AiService } from '../../services/ai.service';
import { signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { UsefulnessService } from '../../services/usefulness.service';

describe('BookmarkDetailComponent', () => {
  let component: BookmarkDetailComponent;
  let fixture: ComponentFixture<BookmarkDetailComponent>;

  function bookmark(id: string, title: string, url: string): chrome.bookmarks.BookmarkTreeNode {
    return { id, title, url };
  }

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(res => {
      resolve = res;
    });
    return { promise, resolve };
  }

  const mockBookmarksFacade = {
    updateBookmark: vi.fn().mockResolvedValue(undefined)
  };

  const mockTagsService = {
    getTagsForBookmark: vi.fn().mockReturnValue([]),
    availableTags: signal([])
  };

  const mockAiService = {
    suggestTags: vi.fn().mockResolvedValue({}),
    scoreUsefulness: vi.fn().mockResolvedValue({})
  };

  const mockUsefulnessService = {
    getRatingForBookmark: vi.fn(),
    setManualScore: vi.fn(),
    setAiScores: vi.fn()
  };

  beforeEach(async () => {
    mockBookmarksFacade.updateBookmark.mockReset().mockResolvedValue(undefined);
    mockAiService.scoreUsefulness.mockReset().mockResolvedValue({});
    mockUsefulnessService.getRatingForBookmark.mockReset();
    mockUsefulnessService.setManualScore.mockReset();
    mockUsefulnessService.setAiScores.mockReset();
    await TestBed.configureTestingModule({
      imports: [ BookmarkDetailComponent, NoopAnimationsModule ],
      providers: [
        { provide: BookmarksFacadeService, useValue: mockBookmarksFacade },
        { provide: TagsService, useValue: mockTagsService },
        { provide: AiService, useValue: mockAiService },
        { provide: UsefulnessService, useValue: mockUsefulnessService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BookmarkDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('synchronizes a refreshed node when the selected ID is unchanged', () => {
    fixture.componentRef.setInput('selection', [
      bookmark('1', 'Original', 'https://old.example')
    ]);
    fixture.detectChanges();

    fixture.componentRef.setInput('selection', [
      bookmark('1', 'Refreshed', 'https://new.example')
    ]);
    fixture.detectChanges();

    expect(component.editForm.getRawValue()).toEqual({
      title: 'Refreshed',
      url: 'https://new.example'
    });
    expect(component.editForm.pristine).toBe(true);
  });

  it('preserves dirty fields while synchronizing pristine fields', () => {
    fixture.componentRef.setInput('selection', [
      bookmark('1', 'Original', 'https://old.example')
    ]);
    fixture.detectChanges();
    component.editForm.controls.title.setValue('Local draft');
    component.editForm.controls.title.markAsDirty();

    fixture.componentRef.setInput('selection', [
      bookmark('1', 'Server title', 'https://new.example')
    ]);
    fixture.detectChanges();

    expect(component.editForm.getRawValue()).toEqual({
      title: 'Local draft',
      url: 'https://new.example'
    });
    expect(component.editForm.dirty).toBe(true);
  });

  it('does not mark a newly selected bookmark pristine when an earlier save completes', async () => {
    const pendingSave = deferred<void>();
    mockBookmarksFacade.updateBookmark.mockReturnValueOnce(pendingSave.promise);
    fixture.componentRef.setInput('selection', [
      bookmark('1', 'First', 'https://first.example')
    ]);
    fixture.detectChanges();
    component.editForm.controls.title.setValue('Saved first');
    component.editForm.controls.title.markAsDirty();

    const save = component.saveChanges();
    fixture.componentRef.setInput('selection', [
      bookmark('2', 'Second', 'https://second.example')
    ]);
    fixture.detectChanges();
    component.editForm.controls.title.setValue('Second draft');
    component.editForm.controls.title.markAsDirty();

    pendingSave.resolve();
    await save;

    expect(mockBookmarksFacade.updateBookmark).toHaveBeenCalledWith('1', {
      title: 'Saved first',
      url: 'https://first.example'
    });
    expect(component.editForm.controls.title.value).toBe('Second draft');
    expect(component.editForm.dirty).toBe(true);
  });

  it('renders the verbatim rubric and stores a manual score', () => {
    fixture.componentRef.setInput('selection', [
      bookmark('1', 'Bookmark', 'https://example.com')
    ]);
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('#usefulness-score') as HTMLSelectElement;
    expect(Array.from(select.options).map(option => option.text)).toEqual([
      'Not rated',
      '1 — very low expected future value',
      '2 — limited, narrow, or easily replaceable value',
      '3 — useful in a specific situation',
      '4 — strong, reusable reference or tool',
      '5 — exceptional, distinctive, or repeatedly valuable'
    ]);

    select.value = '4';
    select.dispatchEvent(new Event('change'));

    expect(mockUsefulnessService.setManualScore).toHaveBeenCalledWith('1', 4);
  });

  it('clears a manual usefulness score through Not rated', () => {
    mockUsefulnessService.getRatingForBookmark.mockReturnValue({ score: 2, source: 'manual' });
    fixture.componentRef.setInput('selection', [
      bookmark('1', 'Bookmark', 'https://example.com')
    ]);
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('#usefulness-score') as HTMLSelectElement;
    select.value = '';
    select.dispatchEvent(new Event('change'));

    expect(mockUsefulnessService.setManualScore).toHaveBeenCalledWith('1', null);
  });

  it('applies AI scores to the explicitly selected bookmarks', async () => {
    const selected = [
      bookmark('1', 'First', 'https://first.example'),
      bookmark('2', 'Second', 'https://second.example')
    ];
    mockAiService.scoreUsefulness.mockResolvedValue({ '1': 3, '2': 5 });
    fixture.componentRef.setInput('selection', selected);
    fixture.detectChanges();

    await component.aiRateUsefulness();

    expect(mockAiService.scoreUsefulness).toHaveBeenCalledWith(selected);
    expect(mockUsefulnessService.setAiScores).toHaveBeenCalledWith({ '1': 3, '2': 5 });
  });
});
