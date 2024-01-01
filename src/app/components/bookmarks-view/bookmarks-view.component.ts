import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {BookmarksProviderService, SelectionService} from '../../services';
import {SearchBoxComponent} from "../search-box";
import {TreeViewComponent} from "../tree-view";
import {ListViewComponent} from "../list-view";
import {BehaviorSubject, debounceTime, mergeMap, of} from "rxjs";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {AsyncPipe} from "@angular/common";

@Component({
  standalone: true,
  selector: 'app-bookmarks-view',
  templateUrl: 'bookmarks-view.component.html',
  imports: [
    SearchBoxComponent,
    TreeViewComponent,
    ListViewComponent,
    AsyncPipe
  ],
  styleUrls: ['./bookmarks-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookmarksViewComponent implements OnInit {
  protected bookmarks: chrome.bookmarks.BookmarkTreeNode[] = [];
  protected directoryTree: chrome.bookmarks.BookmarkTreeNode[]  = [];

  protected selectedDirectory = BookmarksProviderService.EmptyDirectory;
  public searchTerm$ = new BehaviorSubject<string>('');
  public selectedItems$ = this.selectionService.onSelectionChanged$;

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
  );

  constructor(private bookmarkProviderService: BookmarksProviderService, private selectionService: SelectionService) {
  }

  ngOnInit() {
    this.bookmarkProviderService.getBookmarks().then((bookmarks) => {
      this.bookmarks = bookmarks[0].children ?? [];
      this.selectedDirectory = bookmarks[0];
    });
  }

  public onDirectorySelected(directory: chrome.bookmarks.BookmarkTreeNode) {
    this.selectedDirectory = directory;
  }

  public search(searchTerm: string|null) {
    this.searchTerm$.next(searchTerm ?? '');
  }
}
