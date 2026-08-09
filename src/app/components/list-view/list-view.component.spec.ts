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
    mockBookmarksFacade.deleteBookmarks.mockReset();
    mockSelectionService.selection.set(new Set());
    mockSelectionService.selectAllActive.set(false);
    mockSelectionService.select.mockReset();
    mockSelectionService.selectAll.mockReset();
    mockTagsService.getTagsForBookmark.mockReset().mockReturnValue([]);
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

  it('deletes all visible bookmarks when select all is active', () => {
    const bookmarks = [
      { id: '1', title: 'Alpha', url: 'https://example.com/1' },
      { id: '2', title: 'Beta', url: 'https://example.com/2' }
    ] as chrome.bookmarks.BookmarkTreeNode[];

    fixture.componentRef.setInput('items', bookmarks);
    mockSelectionService.selectAllActive.set(true);
    mockSelectionService.selection.set(new Set());
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

  it('uses Meta+click for additive selection on macOS', () => {
    const bookmark = {
      id: '1',
      title: 'Alpha',
      url: 'https://example.com/1'
    } as chrome.bookmarks.BookmarkTreeNode;
    const event = {
      detail: 1,
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn()
    } as unknown as MouseEvent;

    component.itemClick(event, bookmark);

    expect(mockSelectionService.select).toHaveBeenCalledWith(bookmark, {
      clear: false,
      range: false,
      toggle: true
    });
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('uses Meta+A for Select All on macOS', () => {
    const event = {
      key: 'a',
      metaKey: true,
      ctrlKey: false,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      target: { localName: 'body' }
    } as unknown as KeyboardEvent;

    expect(component.onKeyup(event)).toBe(false);
    expect(mockSelectionService.selectAll).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('sorts the visible Tags column using persisted tag values', () => {
    const bookmarks = [
      { id: '1', title: 'First', url: 'https://first.example' },
      { id: '2', title: 'Second', url: 'https://second.example' }
    ] as chrome.bookmarks.BookmarkTreeNode[];
    mockTagsService.getTagsForBookmark.mockImplementation((id: string) =>
      id === '1' ? ['Work'] : ['Archive']
    );
    fixture.componentRef.setInput('items', bookmarks);

    component.orderBy('tags');
    fixture.detectChanges();

    expect(component.visibleItems().map(item => item.id)).toEqual(['2', '1']);
  });

  it('exposes sort state and keyboard-operable column headers', () => {
    component.orderBy('title');
    fixture.detectChanges();

    const titleHeader = fixture.nativeElement.querySelector('th[aria-sort="ascending"]');
    const sortButton = titleHeader.querySelector('button');

    expect(sortButton.textContent).toContain('Title');
    expect(sortButton.getAttribute('aria-label')).toBe('Sort by Title');
  });

  it('selects a focused row with Space', () => {
    const bookmark = {
      id: '1',
      title: 'Alpha',
      url: 'https://example.com/1'
    } as chrome.bookmarks.BookmarkTreeNode;
    const event = {
      key: ' ',
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    } as unknown as KeyboardEvent;

    component.onItemKeydown(event, bookmark);

    expect(mockSelectionService.select).toHaveBeenCalledWith(bookmark, {
      clear: true,
      range: false,
      toggle: false
    });
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });
});
