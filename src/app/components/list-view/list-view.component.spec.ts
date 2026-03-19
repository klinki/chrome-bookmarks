import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { vi } from 'vitest';
import { ListViewComponent } from './list-view.component';
import { SelectionService } from '../../services/selection.service';
import { BookmarksFacadeService } from '../../services/bookmarks-facade.service';
import { TagsService } from '../../services/tags.service';
import { BookmarksService } from '../../services/chrome/bookmarks/bookmarks.service';
import { MockBookmarksService } from '../../services/chrome/bookmarks/mock-bookmarks.service';
import { signal } from '@angular/core';

describe('Component: ListView', () => {
  let component: ListViewComponent;
  let fixture: ComponentFixture<ListViewComponent>;
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  const mockSelectionService = {
    selection: signal(new Set<string>()),
    selectAllActive: signal(false),
    select: vi.fn(),
    clearSelection: vi.fn(),
    selectAll: vi.fn(),
    items: [],
    itemsSignal: signal([])
  };

  const mockBookmarksFacade = {
    items: signal([]),
    deleteProgress: signal({
      active: false,
      total: 0,
      completed: 0
    }),
    deleteBookmarks: vi.fn()
  };

  const mockTagsService = {
    getTagsForBookmark: vi.fn().mockReturnValue([])
  };

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ListViewComponent],
      providers: [
        { provide: SelectionService, useValue: mockSelectionService },
        { provide: BookmarksFacadeService, useValue: mockBookmarksFacade },
        { provide: TagsService, useValue: mockTagsService },
        { provide: BookmarksService, useClass: MockBookmarksService }
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    vi.useFakeTimers();
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fixture = TestBed.createComponent(ListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    confirmSpy.mockRestore();
    vi.useRealTimers();
  });

  it('should create an instance', () => {
    expect(component).toBeTruthy();
  });

  it('defers deleteBookmarks until after the confirm dialog closes', () => {
    const bookmarks = [
      { id: '1', title: 'Alpha', url: 'https://example.com/1' },
      { id: '2', title: 'Beta', url: 'https://example.com/2' }
    ] as chrome.bookmarks.BookmarkTreeNode[];

    fixture.componentRef.setInput('items', bookmarks);
    mockSelectionService.selection.set(new Set(['1', '2']));
    fixture.detectChanges();

    const event = {
      key: 'Delete',
      ctrlKey: false,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      target: { localName: 'body' }
    } as any;

    component.onKeyup(event);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(mockBookmarksFacade.deleteBookmarks).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(mockBookmarksFacade.deleteBookmarks).toHaveBeenCalledTimes(1);
    expect(mockBookmarksFacade.deleteBookmarks).toHaveBeenCalledWith(bookmarks);
  });
});
