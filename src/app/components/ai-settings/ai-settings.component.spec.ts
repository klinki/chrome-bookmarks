import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AiSettingsComponent } from './ai-settings.component';
import { BookmarksStore } from '../../services/bookmarks.store';
import { TagsService } from '../../services/tags.service';
import { AiService } from '../../services/ai.service';
import { BookmarksProviderService } from '../../services/bookmarks-provider.service';
import { FormBuilder, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('AiSettingsComponent', () => {
  let component: AiSettingsComponent;
  let fixture: ComponentFixture<AiSettingsComponent>;

  const mockStore = {
    prefs: {
      aiConfig: signal({
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'test-key',
        model: 'llama3:8b'
      })
    },
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
    providers: [],
    discoverProviderModels: vi.fn().mockResolvedValue([])
  };

  const mockProviderService = {
      getBookmarks: vi.fn().mockResolvedValue([])
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiSettingsComponent, ReactiveFormsModule, FormsModule],
      providers: [
        { provide: BookmarksStore, useValue: mockStore },
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
});
