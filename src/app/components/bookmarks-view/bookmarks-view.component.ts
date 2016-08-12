import { Component, OnInit } from '@angular/core';
import { BookmarksProviderService, SelectionService } from '../../services/index';

@Component({
  moduleId: module.id,
  selector: 'app-bookmarks-view',
  templateUrl: 'bookmarks-view.component.html',
  styleUrls: ['bookmarks-view.component.css']
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
    this.bookmarkService.onSelectionChanged.subscribe((bookmark) => {
        self.bookmarkProviderService.getChildren(bookmark.id).then((children) => {
          self.items = children;
        });
    });
  }

  ngOnInit() {
    this.bookmarkProviderService.getBookmarks().then((bookmarks) => {
      this.bookmarks = bookmarks[0].children;
      this.selectedDirectory = bookmarks[0];
    });

    this.bookmarkProviderService.getBookmarks().then((bookmarks) => {
      let directories = this.bookmarkProviderService.filterDirectories(bookmarks[0].children);
      this.directoryTree = directories;
    });
  }

  public onDirectorySelected(directory) {
    this.selectedDirectory = directory;
  }
}
