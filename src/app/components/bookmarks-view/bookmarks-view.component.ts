import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {BookmarksProviderService, SelectionService} from '../../services';
import {SearchBoxComponent} from "../search-box";
import {TreeViewComponent} from "../tree-view";
import {ListViewComponent} from "../list-view";
import {mergeMap, of} from "rxjs";
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

  public directories$ = fromPromise(this.bookmarkProviderService.getDirectoryTreeWithoutRoot());
  public items$ = this.bookmarkService.selectedDirectory$.asObservable().pipe(
    mergeMap(directory => {
      if (directory == null) {
        return of([]);
      }

      return fromPromise(this.bookmarkProviderService.getChildren(directory.id));
    })
  );

  constructor(private bookmarkProviderService: BookmarksProviderService, private bookmarkService: SelectionService) {
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
}
