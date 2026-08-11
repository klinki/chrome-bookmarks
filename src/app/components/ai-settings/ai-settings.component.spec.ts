import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AiSettingsComponent } from './ai-settings.component';
import { AiStore } from '../../services/ai.store';
import { TagsService } from '../../services/tags.service';
import { AiService } from '../../services/ai.service';
import { BookmarksProviderService } from '../../services/bookmarks-provider.service';
import { FormBuilder, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { CdkTrapFocus } from '@angular/cdk/a11y';

describe('AiSettingsComponent', () => {
  let component: AiSettingsComponent;
  let fixture: ComponentFixture<AiSettingsComponent>;

  const mockStore = {
    aiConfig: signal({
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'test-key',
      model: 'llama3:8b',
      allowNewTags: false
    }),
    progress: signal({
      total: 10,
      processed: 5,
      isProcessing: false,
      isPaused: false,
      isCancelled: false,
      currentBatch: 'Batch 1',
      operation: null
    }),
    checkpoint: signal(null),
    updateAiConfig: vi.fn(),
    togglePause: vi.fn(),
    cancelProcessing: vi.fn()
  };

  const mockTagsService = {
    availableTags: signal(['tag1', 'tag2', 'tag3']),
    addAvailableTag: vi.fn(),
    removeAvailableTag: vi.fn()
  };

  const mockAiService = {
    providers: [{
      name: 'Ollama',
      discoveryUrl: 'http://localhost:11434',
      completionUrl: 'http://localhost:11434/v1'
    }],
    discoverProviderModels: vi.fn().mockResolvedValue([]),
    categorizeAll: vi.fn().mockResolvedValue(undefined),
    rateUsefulnessInBulk: vi.fn().mockResolvedValue(undefined),
    resumeCheckpoint: vi.fn().mockResolvedValue(undefined),
    discardCheckpoint: vi.fn(),
    cancelProcessing: vi.fn()
  };

  const mockProviderService = {
      getBookmarks: vi.fn().mockResolvedValue([])
  };

  beforeEach(async () => {
    (mockStore.checkpoint as any).set(null);
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [AiSettingsComponent, ReactiveFormsModule, FormsModule],
      providers: [
        { provide: AiStore, useValue: mockStore },
        { provide: TagsService, useValue: mockTagsService },
        { provide: AiService, useValue: mockAiService },
        { provide: BookmarksProviderService, useValue: mockProviderService },
        FormBuilder
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AiSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render tags', () => {
    const tagElements = fixture.debugElement.queryAll(By.css('.tag-item'));
    expect(tagElements.length).toBe(3);
    expect(tagElements[0].nativeElement.textContent).toContain('tag1');
  });

  it('renders the exact usefulness rubric and starts both bulk modes', async () => {
    const rubric = Array.from(
      fixture.nativeElement.querySelectorAll('.usefulness-rubric li') as NodeListOf<HTMLElement>
    ).map(item => item.textContent?.trim());
    expect(rubric).toEqual([
      '1 — very low expected future value',
      '2 — limited, narrow, or easily replaceable value',
      '3 — useful in a specific situation',
      '4 — strong, reusable reference or tool',
      '5 — exceptional, distinctive, or repeatedly valuable'
    ]);

    await component.rateUsefulness('unscored');
    await component.rateUsefulness('rerate-ai');

    expect(mockAiService.rateUsefulnessInBulk).toHaveBeenNthCalledWith(1, [], 'unscored');
    expect(mockAiService.rateUsefulnessInBulk).toHaveBeenNthCalledWith(2, [], 'rerate-ai');
  });

  it('traps discovery dialog focus and restores it to the trigger', async () => {
    const trigger = fixture.nativeElement.querySelector('.discovery-trigger-btn') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(fixture.debugElement.query(By.directive(CdkTrapFocus))).toBeTruthy();

    const triggerFocus = vi.spyOn(trigger, 'focus');
    const close = dialog.querySelector('.close-btn') as HTMLButtonElement;
    close.click();
    fixture.detectChanges();
    await Promise.resolve();

    expect(triggerFocus).toHaveBeenCalled();
  });

  it('offers resume and discard actions for an unfinished AI job', async () => {
    (mockStore.checkpoint as any).set({
      version: 1,
      operation: 'usefulness-unscored',
      candidateIds: ['1', '2'],
      nextCursor: 1,
      total: 2,
      createdAt: 1,
      updatedAt: 2,
      promptVersion: 1,
      configurationFingerprint: 'fingerprint',
      status: 'interrupted'
    });
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.checkpoint-card') as HTMLElement;
    expect(card.textContent).toContain('1 / 2 processed');
    const buttons = Array.from(card.querySelectorAll('button')) as HTMLButtonElement[];
    buttons.find(button => button.textContent?.trim() === 'Resume')?.click();
    buttons.find(button => button.textContent?.trim() === 'Discard')?.click();
    await fixture.whenStable();

    expect(mockAiService.resumeCheckpoint).toHaveBeenCalledWith([]);
    expect(mockAiService.discardCheckpoint).toHaveBeenCalledTimes(1);
  });
});
