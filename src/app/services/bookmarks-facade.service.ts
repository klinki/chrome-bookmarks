import { computed, inject, Injectable, signal } from '@angular/core';
import { BookmarksProviderService } from "./bookmarks-provider.service";
import { TagsService } from "./tags.service";
import { combineLatest, debounceTime, filter, from, map, merge, of, shareReplay, startWith, switchMap, tap } from "rxjs";
import { SelectionService } from "./selection.service";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import {
  BulkMutationCoordinatorService,
  BulkMutationError
} from './bulk-mutation-coordinator.service';
import { UsefulnessService } from './usefulness.service';
import { QuarantineService } from './quarantine.service';
import { SearchIndexService } from './search-index.service';
import { createSearchDocuments } from './search-documents';
import { SearchParseError, SearchQueryAst, SEARCH_QUERY_VERSION } from './search.types';
import {
  formatSearchQuery,
  getSearchChips,
  parseSearchQuery,
  removeSearchChip
} from './search-query';
import { SmartCollectionsService } from './smart-collections.service';
import type { BookmarkSortColumn } from '../pipes/order-by.pipe';

interface BookmarkTreeSnapshot {
  tree: chrome.bookmarks.BookmarkTreeNode[];
  directories: chrome.bookmarks.BookmarkTreeNode[];
  nodeMap: Readonly<Record<string, chrome.bookmarks.BookmarkTreeNode>>;
  bookmarks: chrome.bookmarks.BookmarkTreeNode[];
  hostnameByBookmarkId: ReadonlyMap<string, string>;
  serverCounts: ReadonlyMap<string, number>;
}

@Injectable()
export class BookmarksFacadeService {
  private bookmarkProviderService = inject(BookmarksProviderService);
  private selectionService = inject(SelectionService);

  private tagsService = inject(TagsService);
  private usefulnessService = inject(UsefulnessService);
  private quarantineService = inject(QuarantineService);
  private searchIndex = inject(SearchIndexService);
  public smartCollectionsService = inject(SmartCollectionsService);
  private bulkMutations = inject(BulkMutationCoordinatorService);
  private pendingDeletionIds = signal<Set<string>>(new Set());
  public deleteProgress = computed(() => {
    const progress = this.bulkMutations.progress();
    return {
      active: progress.active && progress.operation === 'delete-bookmarks',
      total: progress.total,
      completed: progress.completed,
      failures: progress.failures,
      cancelled: progress.cancelled
    };
  });


  // Signals
  public searchTerm = signal<string>('');
  public searchError = signal<SearchParseError | null>(null);
  public searchScopeFolderId = signal<string | undefined>(undefined);
  public selectedSmartCollectionId = signal<string | undefined>(undefined);
  public selectedSmartCollection = computed(() => {
    const id = this.selectedSmartCollectionId();
    return id ? this.smartCollectionsService.get(id) : undefined;
  });
  private validSearchAst = signal<SearchQueryAst>({
    version: SEARCH_QUERY_VERSION,
    expression: null
  });
  public searchChips = computed(() => getSearchChips(this.validSearchAst()));
  public isSearchActive = computed(() => Boolean(
    this.validSearchAst().expression || this.searchScopeFolderId()
  ));
  public selectedBookmarkIds = this.selectionService.selection;

  public onBookmarksUpdated$ = merge(
    merge(
      this.bookmarkProviderService.onMovedEvent$,
      this.bookmarkProviderService.onChangedEvent$,
      this.bookmarkProviderService.onCreatedEvent$,
      this.bookmarkProviderService.onRemovedEvent$,
    ).pipe(
      filter(() => !this.bulkMutations.isActive()),
      map(() => null)
    ),
    this.bulkMutations.completed$.pipe(map(() => null))
  ).pipe(
    startWith(null),
    shareReplay(1)
  );

  private readonly treeSnapshot$ = this.onBookmarksUpdated$.pipe(
    switchMap(() => from(this.bookmarkProviderService.getBookmarks())),
    map(tree => this.createTreeSnapshot(tree)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  public bookmarksMap = toSignal(
    this.treeSnapshot$.pipe(map(snapshot => snapshot.nodeMap)),
    { initialValue: {} as Readonly<Record<string, chrome.bookmarks.BookmarkTreeNode>> }
  );

  public searchScopeFolders = computed(() => Object.values(this.bookmarksMap())
    .filter(node => !node.url && node.parentId !== undefined)
    .sort((left, right) => left.title.localeCompare(right.title)));

  public directories = toSignal(
    combineLatest([
      this.treeSnapshot$,
      toObservable(this.tagsService.availableTags),
      toObservable(this.smartCollectionsService.collections)
    ]).pipe(
      map(([snapshot, tags, collections]): chrome.bookmarks.BookmarkTreeNode[] => {
        const topServers: chrome.bookmarks.BookmarkTreeNode[] = Array.from(snapshot.serverCounts)
          .sort((left, right) => right[1] - left[1])
          .slice(0, 20)
          .map(([hostname]) => ({
            id: 'SERVER_' + hostname,
            title: hostname,
            url: undefined,
            children: []
          }));

        return [
          {
            id: 'ROOT_SMART_COLLECTIONS',
            title: 'Smart Collections',
            children: collections.map(collection => ({
              id: `SMART_${collection.id}`,
              title: collection.name,
              children: []
            }))
          },
          {
            id: 'ROOT_TAGS',
            title: 'Tags',
            children: tags.map(tag => ({
              id: 'TAG_' + tag,
              title: tag,
              url: undefined,
              children: []
            }))
          },
          {
            id: 'ROOT_SERVERS',
            title: 'Servers (Top 20)',
            children: topServers
          },
          {
            id: 'ROOT_ALL',
            title: 'All Bookmarks',
            children: snapshot.directories
          }
        ];
      })
    ),
    { initialValue: [] as chrome.bookmarks.BookmarkTreeNode[] }
  );

  private readonly smartCollectionSelection = toObservable(
    this.selectionService.selectedDirectory
  ).subscribe(directory => {
    if (directory?.id.startsWith('SMART_')) {
      this.activateSmartCollection(directory.id.slice('SMART_'.length), false);
      return;
    }
    if (this.selectedSmartCollectionId()) {
      this.selectedSmartCollectionId.set(undefined);
      this.applySearch('', undefined);
    }
  });

  private readonly indexedSnapshot$ = combineLatest([
    this.treeSnapshot$,
    toObservable(this.tagsService.bookmarkTags),
    toObservable(this.usefulnessService.bookmarkUsefulness),
    toObservable(this.quarantineService.records)
  ]).pipe(
    debounceTime(100),
    switchMap(async ([snapshot, tags, usefulness, quarantine]) => {
      await Promise.all([
        this.tagsService.whenReady(),
        this.usefulnessService.whenReady()
      ]);
      await this.searchIndex.rebuild(createSearchDocuments(
        snapshot.tree,
        tags,
        usefulness,
        quarantine
      ));
      return snapshot;
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private readonly searchResults$ = combineLatest([
    this.indexedSnapshot$,
    toObservable(this.validSearchAst),
    toObservable(this.searchScopeFolderId),
    toObservable(this.isSearchActive)
  ]).pipe(
    debounceTime(150),
    switchMap(([snapshot, query, scopeFolderId, active]) => active
      ? from(this.searchIndex.query(query, scopeFolderId)).pipe(
        map(nodeIds => nodeIds
          .map(nodeId => snapshot.nodeMap[nodeId])
          .filter((node): node is chrome.bookmarks.BookmarkTreeNode => Boolean(node)))
      )
      : of([] as chrome.bookmarks.BookmarkTreeNode[])),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  public items = toSignal(
    combineLatest([
      this.treeSnapshot$,
      toObservable(this.selectionService.selectedDirectory),
      toObservable(this.isSearchActive),
      this.searchResults$,
      toObservable(this.pendingDeletionIds)
    ]).pipe(
      switchMap(([snapshot, directory, searchActive, searchResults, pendingDeletionIds]) => {
        if (searchActive) {
          return of(searchResults.filter(item => !pendingDeletionIds.has(item.id)));
        }

        if (directory == null) {
          return of([]);
        }

        if (directory.id === 'ROOT_ALL') {
          return of(snapshot.directories.filter(item => !pendingDeletionIds.has(item.id)));
        }

        if (directory.id === 'ROOT_TAGS' || directory.id === 'ROOT_SERVERS') {
          return of([]);
        }

        if (directory.id.startsWith('TAG_')) {
          const tagName = directory.title;
          return of(snapshot.bookmarks.filter(bookmark =>
            this.tagsService.getTagsForBookmark(bookmark.id).includes(tagName)
            && !pendingDeletionIds.has(bookmark.id)
          ));
        }

        if (directory.id.startsWith('SERVER_')) {
          const hostname = directory.title;
          return of(snapshot.bookmarks.filter(bookmark =>
            snapshot.hostnameByBookmarkId.get(bookmark.id) === hostname
            && !pendingDeletionIds.has(bookmark.id)
          ));
        }

        const children = snapshot.nodeMap[directory.id]?.children ?? [];
        return of(children.filter(item => !pendingDeletionIds.has(item.id)));
      }),
      tap(items => {
        this.selectionService.items = items;
      })
    ),
    { initialValue: [] }
  );

  public selectedBookmarks = toSignal(
    combineLatest([
      toObservable(this.items),
      toObservable(this.selectedBookmarkIds),
      toObservable(this.selectionService.selectAllActive)
    ]).pipe(
      map(([allItems, selectedIds, selectAllActive]) => {
        return (allItems ?? []).filter((x: chrome.bookmarks.BookmarkTreeNode) => {
          if (!selectAllActive) {
            return selectedIds.has(x.id);
          }
          return !selectedIds.has(x.id);
        });
      })
    ),
    { initialValue: [] }
  );

  private createTreeSnapshot(tree: chrome.bookmarks.BookmarkTreeNode[]): BookmarkTreeSnapshot {
    const nodeMap: Record<string, chrome.bookmarks.BookmarkTreeNode> = {};
    const bookmarks: chrome.bookmarks.BookmarkTreeNode[] = [];
    const hostnameByBookmarkId = new Map<string, string>();
    const serverCounts = new Map<string, number>();
    const stack = [...tree];

    while (stack.length > 0) {
      const node = stack.pop()!;
      nodeMap[node.id] = node;
      if (node.url) {
        bookmarks.push(node);
        try {
          const hostname = new URL(node.url).hostname;
          hostnameByBookmarkId.set(node.id, hostname);
          serverCounts.set(hostname, (serverCounts.get(hostname) ?? 0) + 1);
        } catch {
          // Invalid bookmark URLs remain available outside server views.
        }
      }
      if (node.children) {
        stack.push(...node.children);
      }
    }

    return {
      tree,
      directories: this.bookmarkProviderService.filterDirectories(tree[0]?.children ?? []),
      nodeMap,
      bookmarks,
      hostnameByBookmarkId,
      serverCounts
    };
  }



  public search(searchTerm: string|null) {
    this.selectionService.clearSelection();
    this.selectedSmartCollectionId.set(undefined);
    this.applySearch(searchTerm ?? '', this.searchScopeFolderId());
  }

  private applySearch(value: string, scopeFolderId?: string): void {
    this.searchTerm.set(value);
    try {
      const parsed = parseSearchQuery(value);
      this.validSearchAst.set(parsed);
      this.searchError.set(null);
    } catch (error) {
      if (error instanceof SearchParseError) {
        this.searchError.set(error);
        return;
      }
      throw error;
    }
    this.searchScopeFolderId.set(scopeFolderId || undefined);
  }

  public setSearchScope(folderId?: string): void {
    this.selectionService.clearSelection();
    this.selectedSmartCollectionId.set(undefined);
    this.searchScopeFolderId.set(folderId || undefined);
  }

  public activateSmartCollection(id: string, selectDirectory = true): void {
    const collection = this.smartCollectionsService.get(id);
    if (!collection) {
      this.selectedSmartCollectionId.set(undefined);
      return;
    }
    this.selectionService.clearSelection();
    this.selectedSmartCollectionId.set(id);
    this.applySearch(collection.query, collection.scopeFolderId);
    if (selectDirectory) {
      this.selectionService.selectDirectory({
        id: `SMART_${id}`,
        title: collection.name,
        children: []
      });
    }
  }

  public createSmartCollection(name: string): void {
    const collection = this.smartCollectionsService.create({
      name,
      query: formatSearchQuery(this.validSearchAst()),
      scopeFolderId: this.searchScopeFolderId()
    });
    this.activateSmartCollection(collection.id);
  }

  public updateSelectedSmartCollection(): void {
    const id = this.selectedSmartCollectionId();
    if (!id) return;
    this.smartCollectionsService.update(id, {
      query: formatSearchQuery(this.validSearchAst()),
      scopeFolderId: this.searchScopeFolderId()
    });
  }

  public editSelectedSmartCollection(query: string): void {
    const id = this.selectedSmartCollectionId();
    if (!id) return;
    parseSearchQuery(query);
    this.smartCollectionsService.update(id, { query });
    this.activateSmartCollection(id);
  }

  public renameSelectedSmartCollection(name: string): void {
    const id = this.selectedSmartCollectionId();
    if (!id) return;
    const updated = this.smartCollectionsService.update(id, { name });
    this.selectionService.selectDirectory({ id: `SMART_${id}`, title: updated.name, children: [] });
  }

  public duplicateSelectedSmartCollection(): void {
    const id = this.selectedSmartCollectionId();
    if (id) this.activateSmartCollection(this.smartCollectionsService.duplicate(id).id);
  }

  public deleteSelectedSmartCollection(): void {
    const id = this.selectedSmartCollectionId();
    if (!id) return;
    this.smartCollectionsService.delete(id);
    this.selectedSmartCollectionId.set(undefined);
    this.applySearch('', undefined);
    this.selectionService.clearDirectorySelection();
  }

  public updateSelectedSmartCollectionSort(column: BookmarkSortColumn, asc: boolean): void {
    const id = this.selectedSmartCollectionId();
    if (id) {
      this.smartCollectionsService.update(id, {
        sortColumn: column,
        sortDirection: asc ? 'asc' : 'desc'
      });
    }
  }

  public removeSearchChip(index: number): void {
    const query = removeSearchChip(this.validSearchAst(), index);
    this.search(formatSearchQuery(query));
  }

  public canonicalizeSearch(): void {
    if (!this.searchError()) {
      this.searchTerm.set(formatSearchQuery(this.validSearchAst()));
    }
  }

  public async deleteBookmarks(bookmarks: chrome.bookmarks.BookmarkTreeNode[]) {
    const uniqueBookmarks = Array.from(new Map(bookmarks.map(bookmark => [bookmark.id, bookmark])).values());
    const pendingIds = new Set(uniqueBookmarks.map(bookmark => bookmark.id));

    if (uniqueBookmarks.length === 0) {
      return;
    }

    this.selectionService.clearSelection();
    this.pendingDeletionIds.set(pendingIds);
    try {
      const result = await this.bulkMutations.run({
        operation: 'delete-bookmarks',
        items: uniqueBookmarks,
        identify: bookmark => bookmark.id,
        concurrency: 8,
        execute: bookmark => bookmark.url
          ? this.bookmarkProviderService.remove(bookmark.id)
          : this.bookmarkProviderService.removeTree(bookmark.id)
      });
      if (result.cancelled || result.failures.length > 0) {
        throw new BulkMutationError(result);
      }
    } finally {
      this.pendingDeletionIds.set(new Set());
    }
  }

  public cancelDelete(): void {
    if (this.deleteProgress().active) {
      this.bulkMutations.cancel();
    }
  }

  public async updateBookmark(id: string, changes: { title?: string; url?: string }) {
    return await this.bookmarkProviderService.update(id, changes);
  }
}

export function injectSelection() {
  return inject(BookmarksFacadeService).selectedBookmarks;
}

export function injectDisplayedItems() {
  return inject(BookmarksFacadeService).items;
}

export function injectAllBookmarksMap() {
  return inject(BookmarksFacadeService).bookmarksMap;
}

export function injectSearchTerm() {
  return inject(BookmarksFacadeService).searchTerm;
}

export function injectIsSearchActive() {
  return inject(BookmarksFacadeService).isSearchActive;
}
