import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Subject } from 'rxjs';

import { BookmarksFacadeService } from './bookmarks-facade.service';
import { BookmarksProviderService } from './bookmarks-provider.service';
import { SelectionService } from './selection.service';
import { TagsService } from './tags.service';
import { AiService } from './ai.service';
import { BookmarksStore } from './bookmarks.store';
import { signal } from '@angular/core';

describe('BookmarksFacadeService', () => {
  let service: BookmarksFacadeService;
  let onCreatedEvent$: Subject<unknown>;
  let onRemovedEvent$: Subject<unknown>;
  let onChangedEvent$: Subject<unknown>;
  let onMovedEvent$: Subject<unknown>;

  function deferred<T>() {
    let resolve!: (value: T) => void;

    const promise = new Promise<T>((res) => {
      resolve = res;
    });

    return { promise, resolve };
  }

  const mockSelectionService = {
    items: [],
    itemsSignal: signal([]),
    selection: signal(new Set<string>()),
    selectedDirectory: signal(null),
    selectAllActive: signal(false),
    clearSelection: vi.fn()
  };
  const mockTagsService = {
    availableTags: signal<string[]>([]),
    bookmarkTags: signal<Record<string, string[]>>({}),
    getTagsForBookmark: vi.fn().mockReturnValue([])
  };
  const mockAiService = {};
  const mockStore = {
    loading: signal(false),
    error: signal(null)
  };

  beforeEach(() => {
    onCreatedEvent$ = new Subject();
    onRemovedEvent$ = new Subject();
    onChangedEvent$ = new Subject();
    onMovedEvent$ = new Subject();

    mockSelectionService.clearSelection.mockReset();
    mockTagsService.getTagsForBookmark.mockReset();
    mockTagsService.getTagsForBookmark.mockReturnValue([]);

    const mockBookmarksProvider = {
      onCreatedEvent$,
      onRemovedEvent$,
      onChangedEvent$,
      onMovedEvent$,
      onChildrenReorderedEvent$: new Subject(),
      onImportBeganEvent$: new Subject(),
      onImportEndedEvent$: new Subject(),
      getDirectoryTree: vi.fn().mockResolvedValue([]),
      getDirectoryTreeWithoutRoot: vi.fn().mockResolvedValue([]),
      getBookmarks: vi.fn().mockResolvedValue([]),
      search: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue(undefined),
      removeTree: vi.fn().mockResolvedValue(undefined)
    };

    TestBed.configureTestingModule({
      providers: [
        BookmarksFacadeService,
        { provide: BookmarksProviderService, useValue: mockBookmarksProvider },
        { provide: SelectionService, useValue: mockSelectionService },
        { provide: TagsService, useValue: mockTagsService },
        { provide: AiService, useValue: mockAiService },
        { provide: BookmarksStore, useValue: mockStore }
      ]
    });
    service = TestBed.inject(BookmarksFacadeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('deletes bookmarks in parallel and clears selection immediately', async () => {
    const mockBookmarksProvider = TestBed.inject(BookmarksProviderService) as unknown as {
      remove: ReturnType<typeof vi.fn>;
    };
    const first = deferred<void>();
    const second = deferred<void>();

    mockBookmarksProvider.remove
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const bookmarks = [
      { id: '1', url: 'https://example.com/1', title: '1' },
      { id: '2', url: 'https://example.com/2', title: '2' }
    ] as chrome.bookmarks.BookmarkTreeNode[];

    const deletion = service.deleteBookmarks(bookmarks);

    expect(mockSelectionService.clearSelection).toHaveBeenCalledTimes(1);
    expect(service.deleteProgress().active).toBe(true);
    expect(service.deleteProgress().total).toBe(2);
    expect(service.deleteProgress().completed).toBe(0);
    expect(mockBookmarksProvider.remove).toHaveBeenCalledTimes(2);
    expect(mockBookmarksProvider.remove).toHaveBeenNthCalledWith(1, '1');
    expect(mockBookmarksProvider.remove).toHaveBeenNthCalledWith(2, '2');

    first.resolve();
    second.resolve();

    await deletion;
    expect(service.deleteProgress().active).toBe(false);
  });

  it('suppresses refresh storms from remove events during bulk delete', async () => {
    const mockBookmarksProvider = TestBed.inject(BookmarksProviderService) as unknown as {
      getBookmarks: ReturnType<typeof vi.fn>;
      getDirectoryTreeWithoutRoot: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    };

    service.directories();

    const initialGetBookmarksCalls = mockBookmarksProvider.getBookmarks.mock.calls.length;
    const initialDirectoryCalls = mockBookmarksProvider.getDirectoryTreeWithoutRoot.mock.calls.length;

    const first = deferred<void>();
    const second = deferred<void>();
    mockBookmarksProvider.remove
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const deletion = service.deleteBookmarks([
      { id: '1', url: 'https://example.com/1', title: '1' },
      { id: '2', url: 'https://example.com/2', title: '2' }
    ] as chrome.bookmarks.BookmarkTreeNode[]);

    onRemovedEvent$.next({});
    onRemovedEvent$.next({});

    expect(mockBookmarksProvider.getBookmarks.mock.calls.length).toBe(initialGetBookmarksCalls);
    expect(mockBookmarksProvider.getDirectoryTreeWithoutRoot.mock.calls.length).toBe(initialDirectoryCalls);

    first.resolve();
    second.resolve();
    await deletion;

    expect(mockBookmarksProvider.getBookmarks.mock.calls.length).toBe(initialGetBookmarksCalls + 1);
    expect(mockBookmarksProvider.getDirectoryTreeWithoutRoot.mock.calls.length).toBe(initialDirectoryCalls + 1);
  });
});
