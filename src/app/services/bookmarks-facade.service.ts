import {Injectable} from '@angular/core';
import {BookmarksProviderService} from "./bookmarks-provider.service";
import {BehaviorSubject, combineLatest, debounceTime, map, mergeMap, of, tap} from "rxjs";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {SelectionService} from "./selection.service";

@Injectable()
export class BookmarksFacadeService {
  public searchTerm$ = new BehaviorSubject<string>('');
  public selectedBookmarkIds$ = this.selectionService.onSelectionChanged$;

  public directories$ = fromPromise(this.bookmarkProviderService.getDirectoryTreeWithoutRoot());
  public items$ = this.searchTerm$.asObservable().pipe(
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
    }),
    tap(items => {
      this.selectionService.items = items;
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
