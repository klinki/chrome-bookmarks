import {inject, Injectable} from '@angular/core';
import {BookmarksProviderService} from "./bookmarks-provider.service";
import {BehaviorSubject, combineLatest, debounceTime, map, merge, mergeMap, of, startWith, switchMap, tap} from "rxjs";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {SelectionService} from "./selection.service";
import {toSignal} from "@angular/core/rxjs-interop";

@Injectable()
export class BookmarksFacadeService {
  public searchTerm$ = new BehaviorSubject<string>('');
  public selectedBookmarkIds$ = this.selectionService.onSelectionChanged$;

  public directories$ = fromPromise(this.bookmarkProviderService.getDirectoryTreeWithoutRoot());

  public onBookmarksUpdated$ = merge(
      this.bookmarkProviderService.onMovedEvent$,
      this.bookmarkProviderService.onChangedEvent$,

  ).pipe(
    tap(ev => {
      console.log(ev);
      console.log('updated');
    }),
  );

  public items$ = this.onBookmarksUpdated$.pipe(
    startWith(null),
    // debounceTime(1),
    switchMap(x => this.itemsWithSearch$),
    tap(items => {
      this.selectionService.items = items;
    })
  );

  public itemsWithSearch$ = this.searchTerm$.asObservable().pipe(
    debounceTime(1000),
    mergeMap(searchTerm => {
      if (searchTerm === '') {
        return this.selectionService.selectedDirectory$.asObservable().pipe(
          mergeMap(directory => {
            if (directory == null) {
              return of([]);
            }

            return fromPromise(this.bookmarkProviderService.getChildren(directory.id));
          })
        );
      }

      return fromPromise(this.bookmarkProviderService.search(searchTerm));
    })
  );

  public selectedBookmarks$ = combineLatest([
    this.items$,
    this.selectedBookmarkIds$
  ]).pipe(
    map(([allItems, selectedItems]) => {
      return allItems.filter(x => {
        if (!this.selectionService.selectAllActive) {
          return selectedItems.has(x.id);
        }

        return !selectedItems.has(x.id);
      });
    })
  );

  constructor(
    private bookmarkProviderService: BookmarksProviderService,
    private selectionService: SelectionService
  ) {
  }


  public search(searchTerm: string|null) {
    this.selectionService.clearSelection();
    this.searchTerm$.next(searchTerm ?? '');
  }
}

export function injectSelection() {
  return toSignal(inject(BookmarksFacadeService).selectedBookmarks$, { initialValue: [] });
}

export function injectDisplayedItems() {
  return toSignal(inject(BookmarksFacadeService).items$, { initialValue: [] });
}
