import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';

@Injectable()
export class BookmarksService {
  /** @deprecated */
  public static MAX_WRITE_OPERATIONS_PER_HOUR;

  /** @deprecated */
  public static MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE;

  public onCreatedEvent;
  public onRemovedEvent;
  public onChangedEvent;
  public onMovedEvent;
  public onChildrenReorderedEvent;
  public onImportBeganEvent;
  public onImportEndedEvent;


  public onCreated;
  public onRemoved;
  public onChanged;
  public onMoved;
  public onChildrenReordered;
  public onImportBegan;
  public onImportEnded;

  constructor() {
    this.onCreatedEvent = new Subject();
  }

  protected initialize() {
    BookmarksService.MAX_WRITE_OPERATIONS_PER_HOUR = chrome.bookmarks.MAX_WRITE_OPERATIONS_PER_HOUR;
    BookmarksService.MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE = chrome.bookmarks.MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE
  }

  protected initializeEventListeners() {

  }

  public get(bookmarkId: string|string[]): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return new Promise(function(resolve, reject) {
      return chrome.bookmarks.get(bookmarkId as any, resolve);
    });
  }

  public getChildren(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return new Promise(function(resolve, reject) {
      return chrome.bookmarks.getChildren(id, resolve);
    });
  }

  public getRecent(count: number): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return new Promise(function(resolve, reject) {
      return chrome.bookmarks.getRecent(count, resolve);
    });
  }

  public getTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return new Promise(function(resolve, reject) {
        return chrome.bookmarks.getTree(resolve);
    });
  }

  public getSubTree(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return new Promise(function(resolve, reject) {
      return chrome.bookmarks.getSubTree(id, resolve);
    });
  }

  public search(term: string|chrome.bookmarks.BookmarkSearchQuery): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return new Promise(function(resolve, reject) {
      return chrome.bookmarks.search(term, resolve);
    });
  }

  public create(bookmark: chrome.bookmarks.BookmarkCreateArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
    return new Promise(function(resolve, reject) {
      return chrome.bookmarks.create(bookmark, resolve);
    });
  }

  public move(id: string, destination: chrome.bookmarks.BookmarkDestinationArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
    return new Promise(function(resolve, reject) {
      return chrome.bookmarks.move(id, destination, resolve);
    });
  }

  public update(id: string, changes: chrome.bookmarks.BookmarkChangesArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
    return new Promise(function(resolve, reject) {
      return chrome.bookmarks.update(id, changes, resolve);
    });
  }

  public remove(id: string): Promise<any> {
    return new Promise(function(resolve, reject) {
      return chrome.bookmarks.update(id, resolve);
    });
  }

  public removeTree(id: string): Promise<any> {
    return new Promise(function(resolve, reject) {
      return chrome.bookmarks.removeTree(id, resolve);
    });
  }
}
