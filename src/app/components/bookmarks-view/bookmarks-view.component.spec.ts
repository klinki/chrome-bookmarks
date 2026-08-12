import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { vi } from 'vitest';
import { BookmarksViewComponent } from './bookmarks-view.component';
import { BookmarksFacadeService } from '../../services/bookmarks-facade.service';
import { DragAndDropService } from '../../services/drag-and-drop.service';
import { SelectionService } from '../../services/selection.service';
import { AiService } from '../../services/ai.service';
import { TagsService } from '../../services/tags.service';
import { ReactiveFormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { BookmarksService } from '../../services/chrome/bookmarks/bookmarks.service';
import { UsefulnessService } from '../../services/usefulness.service';

describe('Component: BookmarksView', () => {
  let component: BookmarksViewComponent;
  let fixture: ComponentFixture<BookmarksViewComponent>;

  const mockBookmarksFacade = {
    selectedBookmarkIds: signal(new Set()),
    directories: signal([]),
    items: signal([]),
    selectedBookmarks: signal([]),
    searchTerm: signal(''),
    searchError: signal(null),
    searchChips: signal([]),
    searchScopeFolderId: signal(undefined),
    searchScopeFolders: signal([]),
    isSearchActive: signal(false),
    deleteProgress: signal({ active: false, total: 0, completed: 0 }),
    search: vi.fn(),
    setSearchScope: vi.fn(),
    removeSearchChip: vi.fn(),
    canonicalizeSearch: vi.fn(),
    updateBookmark: vi.fn()
  };

  const mockDragAndDropService = {
    start: vi.fn()
  };

  const mockSelectionService = {
    selectedDirectory: signal(null),
    selection: signal(new Set()),
    selectAllActive: signal(false),
    selectDirectory: vi.fn(),
    expandDirectories: vi.fn(),
    isDirectoryExpanded: vi.fn().mockReturnValue(false),
    toggleDirectory: vi.fn(),
    clearSelection: vi.fn(),
    select: vi.fn(),
    selectAll: vi.fn(),
    items: []
  };

  const mockTagsService = {
    getTagsForBookmark: vi.fn().mockReturnValue([]),
    availableTags: signal([]),
    bookmarkTags: signal({}),
    setTagsForBookmarks: vi.fn(),
    addAvailableTags: vi.fn()
  };


  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [BookmarksViewComponent, NoopAnimationsModule, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        { provide: BookmarksFacadeService, useValue: mockBookmarksFacade },
        { provide: DragAndDropService, useValue: mockDragAndDropService },
        { provide: SelectionService, useValue: mockSelectionService },
        { provide: BookmarksService, useValue: { get: vi.fn(), remove: vi.fn() } },
        { provide: AiService, useValue: { suggestTags: vi.fn() } },
        { provide: TagsService, useValue: mockTagsService },
        { provide: UsefulnessService, useValue: { getRatingForBookmark: vi.fn() } }
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    mockDragAndDropService.start.mockClear();
    fixture = TestBed.createComponent(BookmarksViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts document drag handling when created', () => {
    expect(component).toBeTruthy();
    expect(mockDragAndDropService.start).toHaveBeenCalledOnce();
  });
});
