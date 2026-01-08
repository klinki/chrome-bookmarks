import { inject, Injectable, signal } from '@angular/core';
import { BookmarksProviderService } from "./bookmarks-provider.service";
import { combineLatest, debounceTime, distinctUntilChanged, map, merge, mergeMap, of, shareReplay, startWith, switchMap, tap } from "rxjs";
import { fromPromise } from "rxjs/internal/observable/innerFrom";
import { SelectionService } from "./selection.service";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";

@Injectable()
export class BookmarksFacadeService {
  private bookmarkProviderService = inject(BookmarksProviderService);
  private selectionService = inject(SelectionService);

  // Signals
  public searchTerm = signal<string>('');

  public directories = toSignal(
    fromPromise(this.bookmarkProviderService.getDirectoryTreeWithoutRoot()),
    { initialValue: [] }
  );

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
      this.debouncedSearchTerm$
    ]).pipe(
      switchMap(([_, directory, searchTerm]) => {
        if (searchTerm !== '') {
          return fromPromise(this.bookmarkProviderService.search(searchTerm));
        }
        if (directory == null) {
          return of([]);
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
