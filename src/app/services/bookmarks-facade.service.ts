import { inject, Injectable, signal } from '@angular/core';
import { BookmarksProviderService } from "./bookmarks-provider.service";
import { TagsService } from "./tags.service";
import { combineLatest, debounceTime, distinctUntilChanged, map, merge, mergeMap, of, shareReplay, startWith, switchMap, tap } from "rxjs";
import { fromPromise } from "rxjs/internal/observable/innerFrom";
import { SelectionService } from "./selection.service";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";

@Injectable()
export class BookmarksFacadeService {
  private bookmarkProviderService = inject(BookmarksProviderService);
  private selectionService = inject(SelectionService);

  private tagsService = inject(TagsService);


  // Signals
  public searchTerm = signal<string>('');
  public selectedBookmarkIds = this.selectionService.selection;

  public onBookmarksUpdated$ = merge(
    this.bookmarkProviderService.onMovedEvent$,
    this.bookmarkProviderService.onChangedEvent$,
    this.bookmarkProviderService.onCreatedEvent$,
    this.bookmarkProviderService.onRemovedEvent$,
  ).pipe(
    tap(ev => {
      console.log(ev);
      console.log('updated');
    }),
    startWith(null),
    shareReplay(1)
  );

  public directories = toSignal(
    combineLatest([
      this.onBookmarksUpdated$.pipe(
        switchMap(() => fromPromise(this.bookmarkProviderService.getDirectoryTreeWithoutRoot()))
      ),
      toObservable(this.tagsService.availableTags)
    ]).pipe(
      map(([tree, tags]) => {
        const _tree = tree as chrome.bookmarks.BookmarkTreeNode[];
        const _tags = tags as string[];

        return [
          {
            id: 'ROOT_TAGS',
            title: 'Tags',
            children: _tags.map(tag => ({
              id: 'TAG_' + tag,
              title: tag,
              url: undefined,
              children: [],
              expanded: false
            })),
            expanded: true
          },
          {
            id: 'ROOT_ALL',
            title: 'All Bookmarks',
            children: _tree,
            expanded: true
          }
        ];
      })
    ),
    { initialValue: [] as any[] }
  );

  private debouncedSearchTerm$ = toObservable(this.searchTerm).pipe(
    debounceTime(300),
    distinctUntilChanged(),
    startWith(this.searchTerm())
  );

  public items = toSignal(
    combineLatest([
      this.onBookmarksUpdated$,
      toObservable(this.selectionService.selectedDirectory).pipe(
        tap(value => {
          console.log('directory changed', value);
        })
      ),
      this.debouncedSearchTerm$,
      toObservable(this.tagsService.bookmarkTags),
      toObservable(this.tagsService.availableTags)
    ]).pipe(
      switchMap(([_, directory, searchTerm, bookmarkTags, availableTags]) => {
        if (searchTerm !== '') {
          return combineLatest([
            fromPromise(this.bookmarkProviderService.search(searchTerm)),
            fromPromise(this.bookmarkProviderService.getBookmarks()), // Need all bookmarks to find tagged ones
          ]).pipe(
            map(([searchResults, allBookmarksTree]) => {
              // 1. Standard Search Results
              const results = [...searchResults];

              // 2. Tag Search Results
              const normalizedSearchTerm = searchTerm.toLowerCase();
              const matchingTags = availableTags.filter(tag =>
                tag.toLowerCase().includes(normalizedSearchTerm)
              );

              if (matchingTags.length > 0) {
                // Flatten the tree to search by ID
                // TODO: optimization - maybe maintain a map or just iterate better?
                // reusing logic from previous steps or creating a helper might be good but for now inline is fine
                const allBookmarks: chrome.bookmarks.BookmarkTreeNode[] = [];
                const stack = [...allBookmarksTree];
                while (stack.length) {
                  const node = stack.pop()!;
                  if (node.url) allBookmarks.push(node);
                  if (node.children) stack.push(...node.children);
                }

                const tagMatches = allBookmarks.filter(b => {
                  const tags = this.tagsService.getTagsForBookmark(b.id);
                  return tags.some(t => matchingTags.includes(t));
                });

                results.push(...tagMatches);
              }

              // 3. Deduplicate
              const uniqueResults = new Map<string, chrome.bookmarks.BookmarkTreeNode>();
              results.forEach(b => uniqueResults.set(b.id, b));
              return Array.from(uniqueResults.values());
            })
          );
        }
        if (directory == null) {
          return of([]);
        }

        // Handle Virtual Nodes
        if (directory.id === 'ROOT_ALL') {
          // Show root children (Bookmarks Bar, Other Bookmarks, etc)
          return fromPromise(this.bookmarkProviderService.getDirectoryTreeWithoutRoot());
        }

        if (directory.id === 'ROOT_TAGS') {
          return of([]);
        }

        if (directory.id.startsWith('TAG_')) {
          const tagName = directory.title;
          // Fetch fresh bookmarks to ensure we have the latest state
          return fromPromise(this.bookmarkProviderService.getBookmarks()).pipe(
            map(tree => {
              const allBookmarks: chrome.bookmarks.BookmarkTreeNode[] = [];
              const stack = [...tree];
              while (stack.length) {
                const node = stack.pop()!;
                if (node.url) allBookmarks.push(node);
                if (node.children) stack.push(...node.children);
              }
              return allBookmarks.filter(b => {
                const tags = this.tagsService.getTagsForBookmark(b.id);
                return tags.includes(tagName);
              });
            })
          );
        }

        return fromPromise(this.bookmarkProviderService.getChildren(directory.id));
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

  constructor() {
  }


  public search(searchTerm: string|null) {
    this.selectionService.clearSelection();
    this.searchTerm.set(searchTerm ?? '');
  }
}

export function injectSelection() {
  return inject(BookmarksFacadeService).selectedBookmarks;
}

export function injectDisplayedItems() {
  return inject(BookmarksFacadeService).items;
}
