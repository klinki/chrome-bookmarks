import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { BookmarkDetailComponent } from './bookmark-detail.component';
import { BookmarksFacadeService } from '../../services/bookmarks-facade.service';
import { TagsService } from '../../services/tags.service';
import { AiService } from '../../services/ai.service';
import { signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('BookmarkDetailComponent', () => {
  let component: BookmarkDetailComponent;
  let fixture: ComponentFixture<BookmarkDetailComponent>;

  const mockBookmarksFacade = {
    updateBookmark: vi.fn().mockResolvedValue(undefined)
  };

  const mockTagsService = {
    getTagsForBookmark: vi.fn().mockReturnValue([]),
    availableTags: signal([])
  };

  const mockAiService = {
    suggestTags: vi.fn().mockResolvedValue({})
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ BookmarkDetailComponent, NoopAnimationsModule ],
      providers: [
        { provide: BookmarksFacadeService, useValue: mockBookmarksFacade },
        { provide: TagsService, useValue: mockTagsService },
        { provide: AiService, useValue: mockAiService }
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
});
