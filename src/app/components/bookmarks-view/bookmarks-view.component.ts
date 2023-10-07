import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {BookmarksProviderService, SelectionService} from '../../services';
import {SearchBoxComponent} from "../search-box";
import {TreeViewComponent} from "../tree-view";
import {ListViewComponent} from "../list-view";

@Component({
  standalone: true,
  selector: 'app-bookmarks-view',
  templateUrl: 'bookmarks-view.component.html',
  imports: [
    SearchBoxComponent,
    TreeViewComponent,
    ListViewComponent
  ],
  styleUrls: ['bookmarks-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookmarksViewComponent implements OnInit {
  protected bookmarkProviderService: BookmarksProviderService;
  protected bookmarkService: SelectionService;

  protected bookmarks: chrome.bookmarks.BookmarkTreeNode[] = [];
  protected directoryTree: chrome.bookmarks.BookmarkTreeNode[]  = [];

  protected selectedDirectory = BookmarksProviderService.EmptyDirectory;
  protected items: chrome.bookmarks.BookmarkTreeNode[]  = [];

  constructor(bookmarkProviderService: BookmarksProviderService, bookmarkService: SelectionService) {
    this.bookmarkProviderService = bookmarkProviderService;
    this.bookmarkService = bookmarkService;

    let self = this;
    this.bookmarkService.onSelectionChanged$.subscribe((bookmark) => {
        self.bookmarkProviderService.getChildren(bookmark.id).then((children) => {
          self.items = children;
        });
    });
  }

  ngOnInit() {
    this.bookmarkProviderService.getBookmarks().then((bookmarks) => {
      this.bookmarks = bookmarks[0].children ?? [];
      this.selectedDirectory = bookmarks[0];
    });

    this.bookmarkProviderService.getBookmarks().then((bookmarks) => {
      const directories = this.bookmarkProviderService.filterDirectories(bookmarks[0].children ?? []);
      this.directoryTree = directories;
    });
  }

  public onDirectorySelected(directory: chrome.bookmarks.BookmarkTreeNode) {
    this.selectedDirectory = directory;
  }
}
