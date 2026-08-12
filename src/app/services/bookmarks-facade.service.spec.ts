import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Subject } from 'rxjs';

import { BookmarksFacadeService } from './bookmarks-facade.service';
import { BookmarksProviderService } from './bookmarks-provider.service';
import { SelectionService } from './selection.service';
import { TagsService } from './tags.service';
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

  async function flushTreeSnapshot() {
    await Promise.resolve();
    await Promise.resolve();
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
    whenReady: vi.fn().mockResolvedValue(undefined),
    getTagsForBookmark: vi.fn().mockReturnValue([])
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
      filterDirectories: vi.fn((nodes: chrome.bookmarks.BookmarkTreeNode[]) =>
        nodes.filter(node => node.url == null)
      ),
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
      ]
    });
    service = TestBed.inject(BookmarksFacadeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('reads one shared tree snapshot per bookmark revision', async () => {
    const mockBookmarksProvider = TestBed.inject(BookmarksProviderService) as unknown as {
      getBookmarks: ReturnType<typeof vi.fn>;
    };

    service.directories();
    service.items();
    service.bookmarksMap();
    await flushTreeSnapshot();

    expect(mockBookmarksProvider.getBookmarks).toHaveBeenCalledTimes(1);

    onCreatedEvent$.next({});
    await flushTreeSnapshot();

    expect(mockBookmarksProvider.getBookmarks).toHaveBeenCalledTimes(2);
  });

  it('derives maps, servers, tags, and selected-folder items from the shared tree', async () => {
    const mockBookmarksProvider = TestBed.inject(BookmarksProviderService) as unknown as {
      getBookmarks: ReturnType<typeof vi.fn>;
    };
    mockBookmarksProvider.getBookmarks.mockResolvedValue([{
      id: '0',
      title: 'root',
      children: [{
        id: 'folder',
        parentId: '0',
        title: 'Folder',
        children: [{
          id: 'bookmark',
          parentId: 'folder',
          title: 'Bookmark',
          url: 'https://example.com/page'
        }]
      }]
    }]);
    mockTagsService.availableTags.set(['Work']);
    mockTagsService.bookmarkTags.set({ bookmark: ['Work'] });
    mockTagsService.getTagsForBookmark.mockImplementation((id: string) =>
      id === 'bookmark' ? ['Work'] : []
    );

    onChangedEvent$.next({});
    await flushTreeSnapshot();

    expect(service.bookmarksMap()['bookmark']?.title).toBe('Bookmark');
    await vi.waitFor(() => {
      const serverRoot = service.directories().find(node => node.id === 'ROOT_SERVERS');
      expect(serverRoot?.children?.map(node => node.title)).toEqual(['example.com']);
    });

    (mockSelectionService.selectedDirectory as any).set({ id: 'TAG_Work', title: 'Work' });
    await vi.waitFor(() => {
      expect(service.items().map(item => item.id)).toEqual(['bookmark']);
    });
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
      remove: ReturnType<typeof vi.fn>;
    };

    service.directories();

    const initialGetBookmarksCalls = mockBookmarksProvider.getBookmarks.mock.calls.length;

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

    first.resolve();
    second.resolve();
    await deletion;

    expect(mockBookmarksProvider.getBookmarks.mock.calls.length).toBe(initialGetBookmarksCalls + 1);
  });

  it('issues one final refresh after a partially failed delete', async () => {
    const mockBookmarksProvider = TestBed.inject(BookmarksProviderService) as unknown as {
      getBookmarks: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    };
    service.directories();
    await flushTreeSnapshot();
    const initialGetBookmarksCalls = mockBookmarksProvider.getBookmarks.mock.calls.length;
    mockBookmarksProvider.remove
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('cannot delete'));

    await expect(service.deleteBookmarks([
      { id: '1', url: 'https://example.com/1', title: '1' },
      { id: '2', url: 'https://example.com/2', title: '2' }
    ] as chrome.bookmarks.BookmarkTreeNode[])).rejects.toThrow('failed for 1 item');

    await flushTreeSnapshot();
    expect(mockBookmarksProvider.getBookmarks.mock.calls.length)
      .toBe(initialGetBookmarksCalls + 1);
  });
});
