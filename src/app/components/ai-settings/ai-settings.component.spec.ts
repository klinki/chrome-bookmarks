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
      currentBatch: 'Batch 1'
    }),
    updateAiConfig: vi.fn(),
    togglePause: vi.fn(),
    cancelCategorization: vi.fn()
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
    discoverProviderModels: vi.fn().mockResolvedValue([])
  };

  const mockProviderService = {
      getBookmarks: vi.fn().mockResolvedValue([])
  };

  beforeEach(async () => {
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
});
