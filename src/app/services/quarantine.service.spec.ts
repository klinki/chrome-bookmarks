import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, vi } from 'vitest';
import { BookmarksProviderService } from './bookmarks-provider.service';
import { BulkMutationCoordinatorService, BulkMutationError } from './bulk-mutation-coordinator.service';
import { ImportExportService } from './import-export.service';
import { QuarantineService } from './quarantine.service';
import { TagsService } from './tags.service';
import { UsefulnessService } from './usefulness.service';

describe('QuarantineService', () => {
  let service: QuarantineService;
  let tree: chrome.bookmarks.BookmarkTreeNode[];
  let provider: ReturnType<typeof createProvider>;
  let tagMap: Record<string, string[]>;
  let tagsService: {
    getTagsForBookmark: ReturnType<typeof vi.fn>;
    setTagsForBookmark: ReturnType<typeof vi.fn>;
    setTagsForBookmarks: ReturnType<typeof vi.fn>;
  };
  let usefulnessService: { setRatingsForBookmarks: ReturnType<typeof vi.fn> };
  let importExport: { exportJson: ReturnType<typeof vi.fn> };
  let storageData: Record<string, unknown>;

  beforeEach(() => {
    tree = createTree();
    provider = createProvider(tree);
    tagMap = {
      keeper: ['reference'],
      copy: ['work'],
      second: ['later']
    };
    tagsService = {
      getTagsForBookmark: vi.fn((nodeId: string) => tagMap[nodeId] ?? []),
      setTagsForBookmark: vi.fn((nodeId: string, tags: string[]) => {
        tagMap[nodeId] = tags;
      }),
      setTagsForBookmarks: vi.fn()
    };
    usefulnessService = { setRatingsForBookmarks: vi.fn() };
    importExport = { exportJson: vi.fn().mockResolvedValue(undefined) };
    storageData = {};
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn((keys: string[], callback: (value: Record<string, unknown>) => void) => {
            callback(Object.fromEntries(keys.map(key => [key, storageData[key]])));
          }),
          set: vi.fn((value: Record<string, unknown>) => {
            Object.assign(storageData, value);
            return Promise.resolve();
          })
        }
      }
    });

    TestBed.configureTestingModule({
      providers: [
        QuarantineService,
        BulkMutationCoordinatorService,
        { provide: BookmarksProviderService, useValue: provider },
        { provide: TagsService, useValue: tagsService },
        { provide: UsefulnessService, useValue: usefulnessService },
        { provide: ImportExportService, useValue: importExport }
      ]
    });
    service = TestBed.inject(QuarantineService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('creates reason folders, records all findings, and merges duplicate tags onto the keeper', async () => {
    const copy = findNode(tree, 'copy')!;

    await service.quarantine({
      items: [copy],
      actionReason: 'exact-duplicate',
      matchedReasonsById: { copy: ['exact-duplicate', 'untagged', 'unrated'] },
      duplicateKeeperId: 'keeper',
      duplicateBookmarkIds: ['keeper', 'copy']
    });

    const other = findNode(tree, '2')!;
    const trash = directFolder(other, 'Trash')!;
    const cleanup = directFolder(trash, 'Cleanup')!;
    const reason = directFolder(cleanup, 'Exact duplicates')!;
    expect(findNode(tree, 'copy')?.parentId).toBe(reason.id);
    expect(service.records()['copy']).toEqual(expect.objectContaining({
      actionReason: 'exact-duplicate',
      matchedReasons: ['exact-duplicate', 'unrated', 'untagged'],
      originalParentId: 'source',
      originalIndex: 1
    }));
    expect(tagMap['keeper']).toEqual(['reference', 'work']);
    expect(tagsService.setTagsForBookmark).toHaveBeenCalledWith('keeper', ['reference', 'work']);
  });

  it('reuses the first matching direct folders by index', async () => {
    const other = findNode(tree, '2')!;
    const laterTrash = appendFolder(other, 'trash-later', 'Trash');
    laterTrash.index = 5;
    const firstTrash = appendFolder(other, 'trash-first', 'Trash');
    firstTrash.index = 1;
    const cleanup = appendFolder(firstTrash, 'cleanup-existing', 'Cleanup');
    const reason = appendFolder(cleanup, 'stale-existing', 'Stale');

    await service.quarantine({ items: [findNode(tree, 'copy')!], actionReason: 'stale' });

    expect(findNode(tree, 'copy')?.parentId).toBe(reason.id);
    expect(provider.create).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Trash' }));
  });

  it('restores in original-index order and falls back when the parent is gone', async () => {
    const source = findNode(tree, 'source')!;
    const missingParent = appendFolder(findNode(tree, '1')!, 'missing-parent', 'Temporary');
    const fallback = appendBookmark(missingParent, 'fallback', 'Fallback', 'https://fallback.example');
    await service.quarantine({
      items: [findNode(tree, 'copy')!, findNode(tree, 'second')!, fallback],
      actionReason: 'stale'
    });
    removeNode(tree, missingParent.id);
    provider.move.mockClear();

    await service.restore(['second', 'fallback', 'copy']);

    expect(provider.move.mock.calls.map(call => call[0])).toEqual(['fallback', 'copy', 'second']);
    expect(provider.move).toHaveBeenNthCalledWith(2, 'copy', { parentId: source.id, index: 1 });
    expect(provider.move).toHaveBeenNthCalledWith(3, 'second', { parentId: source.id, index: 2 });
    const restored = directFolder(findNode(tree, '2')!, 'Restored from Cleanup')!;
    expect(findNode(tree, 'fallback')?.parentId).toBe(restored.id);
    expect(service.records()).toEqual({});
  });

  it('does not purge unless backup initiation succeeds, then cleans metadata and records', async () => {
    await service.quarantine({ items: [findNode(tree, 'copy')!], actionReason: 'unrated' });
    importExport.exportJson.mockRejectedValueOnce(new Error('download failed'));

    await expect(service.purge(['copy'])).rejects.toThrow('download failed');
    expect(provider.remove).not.toHaveBeenCalled();
    expect(findNode(tree, 'copy')).toBeTruthy();

    await service.purge(['copy']);

    expect(provider.remove).toHaveBeenCalledWith('copy');
    expect(tagsService.setTagsForBookmarks).toHaveBeenCalledWith({ copy: [] });
    expect(usefulnessService.setRatingsForBookmarks).toHaveBeenCalledWith({ copy: null });
    expect(service.records()['copy']).toBeUndefined();
  });

  it('keeps records only for successful moves when a batch partially fails', async () => {
    provider.move.mockImplementationOnce(provider.move.getMockImplementation()!)
      .mockRejectedValueOnce(new Error('cannot move'));

    await expect(service.quarantine({
      items: [findNode(tree, 'copy')!, findNode(tree, 'second')!],
      actionReason: 'low-usefulness'
    })).rejects.toBeInstanceOf(BulkMutationError);

    expect(service.records()['copy']).toBeTruthy();
    expect(service.records()['second']).toBeUndefined();
  });

  it('removes stale records after an item is manually moved out of Trash', async () => {
    await service.quarantine({ items: [findNode(tree, 'copy')!], actionReason: 'stale' });
    await provider.move('copy', { parentId: 'source' });

    await service.reconcileRecords();

    expect(service.records()['copy']).toBeUndefined();
  });

  it('refuses to purge a recorded item that was manually moved out of Cleanup', async () => {
    await service.quarantine({ items: [findNode(tree, 'copy')!], actionReason: 'stale' });
    await provider.move('copy', { parentId: 'source' });
    importExport.exportJson.mockClear();
    provider.remove.mockClear();

    await service.purge(['copy']);

    expect(importExport.exportJson).not.toHaveBeenCalled();
    expect(provider.remove).not.toHaveBeenCalled();
    expect(findNode(tree, 'copy')).toBeTruthy();
    expect(service.records()['copy']).toBeUndefined();
  });
});

function createTree(): chrome.bookmarks.BookmarkTreeNode[] {
  const root: chrome.bookmarks.BookmarkTreeNode = { id: '0', title: 'root', children: [], syncing: false };
  const bar = appendFolder(root, '1', 'Bookmarks Bar');
  appendFolder(root, '2', 'Other Bookmarks');
  const source = appendFolder(bar, 'source', 'Source');
  appendBookmark(source, 'keeper', 'Keeper', 'https://duplicate.example');
  appendBookmark(source, 'copy', 'Copy', 'https://duplicate.example');
  appendBookmark(source, 'second', 'Second', 'https://second.example');
  return [root];
}

function createProvider(tree: chrome.bookmarks.BookmarkTreeNode[]) {
  const moved = new Subject<unknown>();
  const removed = new Subject<unknown>();
  let nextId = 1;
  const provider = {
    onMovedEvent$: moved,
    onRemovedEvent$: removed,
    getBookmarks: vi.fn(async () => tree),
    create: vi.fn(async (input: chrome.bookmarks.CreateDetails) => {
      const parent = findNode(tree, input.parentId!)!;
      const node: chrome.bookmarks.BookmarkTreeNode = {
        id: `created-${nextId++}`,
        parentId: parent.id,
        index: parent.children?.length ?? 0,
        title: input.title ?? '',
        syncing: false,
        ...(input.url ? { url: input.url } : { children: [] })
      };
      parent.children ??= [];
      parent.children.push(node);
      return node;
    }),
    move: vi.fn(async (nodeId: string, destination: chrome.bookmarks.MoveDestination) => {
      const node = findNode(tree, nodeId)!;
      const previousParent = findNode(tree, node.parentId!)!;
      previousParent.children = previousParent.children?.filter(child => child.id !== nodeId);
      reindex(previousParent);
      const parent = findNode(tree, destination.parentId!)!;
      parent.children ??= [];
      const index = destination.index === undefined
        ? parent.children.length
        : Math.min(destination.index, parent.children.length);
      parent.children.splice(index, 0, node);
      node.parentId = parent.id;
      reindex(parent);
      moved.next([nodeId, destination]);
      return node;
    }),
    remove: vi.fn(async (nodeId: string) => {
      removeNode(tree, nodeId);
      removed.next([nodeId]);
    }),
    removeTree: vi.fn(async (nodeId: string) => {
      removeNode(tree, nodeId);
      removed.next([nodeId]);
    })
  };
  return provider;
}

function appendFolder(
  parent: chrome.bookmarks.BookmarkTreeNode,
  id: string,
  title: string
): chrome.bookmarks.BookmarkTreeNode {
  parent.children ??= [];
  const folder: chrome.bookmarks.BookmarkTreeNode = {
    id,
    parentId: parent.id,
    index: parent.children.length,
    title,
    children: []
  };
  parent.children.push(folder);
  return folder;
}

function appendBookmark(
  parent: chrome.bookmarks.BookmarkTreeNode,
  id: string,
  title: string,
  url: string
): chrome.bookmarks.BookmarkTreeNode {
  parent.children ??= [];
  const bookmark: chrome.bookmarks.BookmarkTreeNode = {
    id,
    parentId: parent.id,
    index: parent.children.length,
    title,
    url
  };
  parent.children.push(bookmark);
  return bookmark;
}

function directFolder(
  parent: chrome.bookmarks.BookmarkTreeNode,
  title: string
): chrome.bookmarks.BookmarkTreeNode | undefined {
  return parent.children?.find(node => !node.url && node.title === title);
}

function findNode(
  tree: readonly chrome.bookmarks.BookmarkTreeNode[],
  nodeId: string
): chrome.bookmarks.BookmarkTreeNode | undefined {
  const stack = [...tree];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.id === nodeId) {
      return node;
    }
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return undefined;
}

function removeNode(tree: chrome.bookmarks.BookmarkTreeNode[], nodeId: string): void {
  const node = findNode(tree, nodeId);
  if (!node?.parentId) {
    return;
  }
  const parent = findNode(tree, node.parentId);
  if (parent?.children) {
    parent.children = parent.children.filter(child => child.id !== nodeId);
    reindex(parent);
  }
}

function reindex(parent: chrome.bookmarks.BookmarkTreeNode): void {
  parent.children?.forEach((child, index) => {
    child.index = index;
  });
}
