import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { BookmarksFacadeService } from './bookmarks-facade.service';
import { BookmarksProviderService } from './bookmarks-provider.service';
import { SelectionService } from './selection.service';
import { TagsService } from './tags.service';
import { AiService } from './ai.service';
import { BookmarksStore } from './bookmarks.store';
import { signal } from '@angular/core';

describe('BookmarksFacadeService', () => {
  let service: BookmarksFacadeService;

  function deferred<T>() {
    let resolve!: (value: T) => void;

    const promise = new Promise<T>((res) => {
      resolve = res;
    });

    return { promise, resolve };
  }

  const mockBookmarksProvider = {
    onCreatedEvent$: { subscribe: () => {} },
    onRemovedEvent$: { subscribe: () => {} },
    onChangedEvent$: { subscribe: () => {} },
    onMovedEvent$: { subscribe: () => {} },
    onChildrenReorderedEvent$: { subscribe: () => {} },
    onImportBeganEvent$: { subscribe: () => {} },
    onImportEndedEvent$: { subscribe: () => {} },
    getDirectoryTree: vi.fn().mockResolvedValue([]),
    getDirectoryTreeWithoutRoot: vi.fn().mockResolvedValue([]),
    getBookmarks: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue([]),
    remove: vi.fn().mockResolvedValue(undefined),
    removeTree: vi.fn().mockResolvedValue(undefined)
  };

  const mockSelectionService = {
    items: [],
    itemsSignal: signal([]),
    selection: signal(new Set<string>()),
    selectedDirectory: signal(null),
    selectAllActive: signal(false),
    clearSelection: vi.fn()
  };
  const mockTagsService = {};
  const mockAiService = {};
  const mockStore = {
    loading: signal(false),
    error: signal(null)
  };

  beforeEach(() => {
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
});
