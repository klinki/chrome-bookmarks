import { inject, Injectable, signal } from '@angular/core';
import { BookmarksProviderService } from "./bookmarks-provider.service";
import { TagsService } from "./tags.service";
import { Subject, combineLatest, debounceTime, distinctUntilChanged, filter, map, merge, of, shareReplay, startWith, switchMap, tap } from "rxjs";
import { fromPromise } from "rxjs/internal/observable/innerFrom";
import { SelectionService } from "./selection.service";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";

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
  private pendingDeletionIds = signal<Set<string>>(new Set());
  private refreshRequested$ = new Subject<void>();
  public deleteProgress = signal({
    active: false,
    total: 0,
    completed: 0
  });


  // Signals
  public searchTerm = signal<string>('');
  public selectedBookmarkIds = this.selectionService.selection;

  public onBookmarksUpdated$ = merge(
    merge(
      this.bookmarkProviderService.onMovedEvent$,
      this.bookmarkProviderService.onChangedEvent$,
      this.bookmarkProviderService.onCreatedEvent$,
      this.bookmarkProviderService.onRemovedEvent$,
    ).pipe(
      filter(() => this.pendingDeletionIds().size === 0),
      map(() => null)
    ),
    this.refreshRequested$.pipe(map(() => null))
  ).pipe(
    tap(ev => {
      console.log(ev);
      console.log('updated');
    }),
    startWith(null),
    shareReplay(1)
  );

  private readonly treeSnapshot$ = this.onBookmarksUpdated$.pipe(
    switchMap(() => fromPromise(this.bookmarkProviderService.getBookmarks())),
    map(tree => this.createTreeSnapshot(tree)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  public bookmarksMap = toSignal(
    this.treeSnapshot$.pipe(map(snapshot => snapshot.nodeMap)),
    { initialValue: {} as Readonly<Record<string, chrome.bookmarks.BookmarkTreeNode>> }
  );

  public directories = toSignal(
    combineLatest([
      this.treeSnapshot$,
      toObservable(this.tagsService.availableTags)
    ]).pipe(
      map(([snapshot, tags]): chrome.bookmarks.BookmarkTreeNode[] => {
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

  private debouncedSearchTerm$ = merge(
    of(this.searchTerm()),
    toObservable(this.searchTerm).pipe(debounceTime(300))
  ).pipe(distinctUntilChanged());

  public items = toSignal(
    combineLatest([
      this.treeSnapshot$,
      toObservable(this.selectionService.selectedDirectory).pipe(
        tap(value => {
          console.log('directory changed', value);
        })
      ),
      this.debouncedSearchTerm$,
      toObservable(this.tagsService.bookmarkTags),
      toObservable(this.tagsService.availableTags),
      toObservable(this.pendingDeletionIds)
    ]).pipe(
      switchMap(([snapshot, directory, searchTerm, _bookmarkTags, availableTags, pendingDeletionIds]) => {
        if (searchTerm !== '') {
          return fromPromise(this.bookmarkProviderService.search(searchTerm)).pipe(
            map(searchResults => {
              const results = [...searchResults];
              const normalizedSearchTerm = searchTerm.toLowerCase();
              const matchingTags = new Set(availableTags.filter(tag =>
                tag.toLowerCase().includes(normalizedSearchTerm)
              ));

              if (matchingTags.size > 0) {
                results.push(...snapshot.bookmarks.filter(bookmark =>
                  this.tagsService.getTagsForBookmark(bookmark.id)
                    .some(tag => matchingTags.has(tag))
                ));
              }

              const uniqueResults = new Map<string, chrome.bookmarks.BookmarkTreeNode>();
              results.forEach(bookmark => uniqueResults.set(bookmark.id, bookmark));
              return Array.from(uniqueResults.values())
                .filter(bookmark => !pendingDeletionIds.has(bookmark.id));
            })
          );
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
    this.searchTerm.set(searchTerm ?? '');
  }

  public async deleteBookmarks(bookmarks: chrome.bookmarks.BookmarkTreeNode[]) {
    const uniqueBookmarks = Array.from(new Map(bookmarks.map(bookmark => [bookmark.id, bookmark])).values());
    const pendingIds = new Set(uniqueBookmarks.map(bookmark => bookmark.id));

    if (uniqueBookmarks.length === 0) {
      return;
    }

    this.selectionService.clearSelection();
    this.pendingDeletionIds.set(pendingIds);
    this.deleteProgress.set({
      active: true,
      total: uniqueBookmarks.length,
      completed: 0
    });

    try {
      const results = await Promise.allSettled(uniqueBookmarks.map(bookmark => {
        return (bookmark.url
          ? this.bookmarkProviderService.remove(bookmark.id)
          : this.bookmarkProviderService.removeTree(bookmark.id)
        ).finally(() => {
          const progress = this.deleteProgress();
          this.deleteProgress.set({
            ...progress,
            completed: Math.min(progress.completed + 1, progress.total)
          });
        });
      }));

      const rejected = results.find(result => result.status === 'rejected');
      if (rejected && rejected.status === 'rejected') {
        throw rejected.reason;
      }
    } finally {
      this.pendingDeletionIds.set(new Set());
      this.deleteProgress.set({
        active: false,
        total: 0,
        completed: 0
      });
      this.refreshRequested$.next();
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
