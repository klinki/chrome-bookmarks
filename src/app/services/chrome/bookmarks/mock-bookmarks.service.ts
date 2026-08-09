import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
  BookmarksService,
  type BookmarkChangedPayload,
  type BookmarkChildrenReorderedPayload,
  type BookmarkCreatedPayload,
  type BookmarkImportPayload,
  type BookmarkMovedPayload,
  type BookmarkRemovedPayload
} from './bookmarks.service';

@Injectable()
export class MockBookmarksService extends BookmarksService {
  private readonly createdEvents = new Subject<BookmarkCreatedPayload>();
  private readonly removedEvents = new Subject<BookmarkRemovedPayload>();
  private readonly changedEvents = new Subject<BookmarkChangedPayload>();
  private readonly movedEvents = new Subject<BookmarkMovedPayload>();

  public override onCreatedEvent$ = this.createdEvents.asObservable();
  public override onRemovedEvent$ = this.removedEvents.asObservable();
  public override onChangedEvent$ = this.changedEvents.asObservable();
  public override onMovedEvent$ = this.movedEvents.asObservable();
  public override onChildrenReorderedEvent$: Observable<BookmarkChildrenReorderedPayload> = new Subject();
  public override onImportBeganEvent$: Observable<BookmarkImportPayload> = new Subject();
  public override onImportEndedEvent$: Observable<BookmarkImportPayload> = new Subject();

  protected bookmarksTree: chrome.bookmarks.BookmarkTreeNode[] = [];
  protected flatBookmarksArray: Record<string, chrome.bookmarks.BookmarkTreeNode> = {};

  private bookmarkId = 0;
  private timestamp = 1_700_000_000_000;

  constructor() {
    super();

    const root = this.addDirectory('0', 'root', null);
    const toolbarBookmarks = this.addDirectory('1', 'Bookmarks Toolbar', root);
    const otherBookmarks = this.addDirectory('2', 'Other Bookmarks', root);
    const shops = this.addDirectory('3', 'E-Shopy', otherBookmarks);
    this.bookmarksTree = [root];
    this.bookmarkId = 4;

    const generatedFolders: chrome.bookmarks.BookmarkTreeNode[] = [];
    for (let index = 0; index < 5; index++) {
      const parent = index % 2 === 0 ? toolbarBookmarks : otherBookmarks;
      generatedFolders.push(this.addDirectory(this.nextBookmarkId(), `Directory ${index + 1}`, parent));
    }

    for (let index = 0; index < 2000; index++) {
      const folder = generatedFolders[index % generatedFolders.length];
      this.addUrl(this.nextBookmarkId(), `Random ${index}`, 'https://centrum.cz', folder);
    }

    this.addUrl(this.nextBookmarkId(), 'Seznam - najdu tam co neznám', 'http://seznam.cz', toolbarBookmarks);
    this.addUrl(this.nextBookmarkId(), 'Google - search', 'http://google.com', otherBookmarks);
    this.addUrl(this.nextBookmarkId(), 'Alza.cz - The annoying green alien', 'http://alza.cz', shops);
    this.addUrl(this.nextBookmarkId(), 'Centrum.cz - centrum vesmíru', 'http://centrum.cz', toolbarBookmarks);
  }

  public override async get(bookmarkId: string|string[]): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    const ids = Array.isArray(bookmarkId) ? bookmarkId : [bookmarkId];
    return ids.map(id => this.clone(this.getBookmark(id)));
  }

  public override async getChildren(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    const bookmark = this.getBookmark(id);
    return (bookmark.children ?? []).map(child => this.clone(child));
  }

  public override async getRecent(count: number): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error('count must be a non-negative integer');
    }

    return Object.values(this.flatBookmarksArray)
      .filter(node => node.url !== undefined)
      .toSorted((left, right) => (right.dateAdded ?? 0) - (left.dateAdded ?? 0))
      .slice(0, count)
      .map(node => this.clone(node));
  }

  public override async getTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return this.clone(this.bookmarksTree);
  }

  public override async getSubTree(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return [this.clone(this.getBookmark(id))];
  }

  public override async search(
    term: string|chrome.bookmarks.BookmarkSearchQuery
  ): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    const results = Object.values(this.flatBookmarksArray).filter(node => {
      const title = node.title.toLowerCase();
      const url = node.url?.toLowerCase() ?? '';

      if (typeof term === 'string') {
        const query = term.toLowerCase();
        return title.includes(query) || url.includes(query);
      }

      const queryMatches = term.query === undefined
        || title.includes(term.query.toLowerCase())
        || url.includes(term.query.toLowerCase());
      const titleMatches = term.title === undefined || title.includes(term.title.toLowerCase());
      const urlMatches = term.url === undefined || url.includes(term.url.toLowerCase());
      return queryMatches && titleMatches && urlMatches;
    });

    return results.map(node => this.clone(node));
  }

  public override async create(
    bookmark: chrome.bookmarks.BookmarkCreateArg
  ): Promise<chrome.bookmarks.BookmarkTreeNode> {
    const parent = this.getFolder(bookmark.parentId ?? '2');
    const index = this.getInsertionIndex(bookmark.index, parent.children?.length ?? 0);
    const newBookmark: chrome.bookmarks.BookmarkTreeNode = {
      id: this.nextBookmarkId(),
      title: bookmark.title ?? '',
      parentId: parent.id,
      index,
      dateAdded: this.nextDate()
    };

    if (bookmark.url === undefined) {
      newBookmark.children = [];
    } else {
      newBookmark.url = bookmark.url;
    }

    parent.children!.splice(index, 0, newBookmark);
    this.flatBookmarksArray[newBookmark.id] = newBookmark;
    this.reindexChildren(parent);

    this.createdEvents.next([newBookmark.id, this.clone(newBookmark)]);
    return this.clone(newBookmark);
  }

  public override async move(
    id: string,
    destination: chrome.bookmarks.BookmarkDestinationArg
  ): Promise<chrome.bookmarks.BookmarkTreeNode> {
    const bookmark = this.getBookmark(id);
    if (!bookmark.parentId) {
      throw new Error('The root bookmark cannot be moved');
    }

    const oldParent = this.getFolder(bookmark.parentId);
    const newParent = this.getFolder(destination.parentId ?? bookmark.parentId);
    if (bookmark.children && this.isDescendant(newParent, bookmark.id)) {
      throw new Error('A folder cannot be moved into itself or a descendant');
    }

    const oldIndex = oldParent.children!.findIndex(child => child.id === id);
    if (oldIndex < 0) {
      throw new Error(`Bookmark ${id} is detached from its parent`);
    }

    const destinationChildCount = newParent.children!.length - (newParent.id === oldParent.id ? 1 : 0);
    const index = this.getInsertionIndex(destination.index, destinationChildCount);
    oldParent.children!.splice(oldIndex, 1);
    bookmark.parentId = newParent.id;
    newParent.children!.splice(index, 0, bookmark);
    this.reindexChildren(oldParent);
    if (newParent.id !== oldParent.id) {
      this.reindexChildren(newParent);
    }

    const moveInfo: chrome.bookmarks.BookmarkMoveInfo = {
      oldIndex,
      index: bookmark.index!,
      oldParentId: oldParent.id,
      parentId: newParent.id
    };
    this.movedEvents.next([id, moveInfo]);
    return this.clone(bookmark);
  }

  public override async update(
    id: string,
    changes: chrome.bookmarks.BookmarkChangesArg
  ): Promise<chrome.bookmarks.BookmarkTreeNode> {
    const bookmark = this.getBookmark(id);
    if (changes.title !== undefined) {
      bookmark.title = changes.title;
    }
    if (changes.url !== undefined) {
      bookmark.url = changes.url;
    }

    const changeInfo: chrome.bookmarks.BookmarkChangeInfo = {
      title: bookmark.title,
      ...(changes.url !== undefined ? { url: changes.url } : {})
    };
    this.changedEvents.next([id, changeInfo]);
    return this.clone(bookmark);
  }

  public override async remove(id: string): Promise<void> {
    const bookmark = this.getBookmark(id);
    if ((bookmark.children?.length ?? 0) > 0) {
      throw new Error('Cannot remove a non-empty folder');
    }

    this.removeNode(bookmark);
  }

  public override async removeTree(id: string): Promise<void> {
    const bookmark = this.getBookmark(id);
    this.removeNode(bookmark);
  }

  protected addDirectory(
    id: string,
    title: string,
    parent: chrome.bookmarks.BookmarkTreeNode|null
  ): chrome.bookmarks.BookmarkTreeNode {
    const directory: chrome.bookmarks.BookmarkTreeNode = {
      id,
      title,
      children: [],
      dateAdded: this.nextDate()
    };

    if (parent) {
      directory.parentId = parent.id;
      directory.index = parent.children!.length;
      parent.children!.push(directory);
    }

    this.flatBookmarksArray[id] = directory;
    return directory;
  }

  protected addUrl(
    id: string,
    title: string,
    url: string,
    directory: chrome.bookmarks.BookmarkTreeNode
  ): chrome.bookmarks.BookmarkTreeNode {
    const bookmark: chrome.bookmarks.BookmarkTreeNode = {
      id,
      title,
      url,
      parentId: directory.id,
      index: directory.children!.length,
      dateAdded: this.nextDate()
    };
    directory.children!.push(bookmark);
    this.flatBookmarksArray[id] = bookmark;
    return bookmark;
  }

  protected getBookmark(id: string): chrome.bookmarks.BookmarkTreeNode {
    const bookmark = this.flatBookmarksArray[id];
    if (!bookmark) {
      throw new Error(`Invalid bookmark id: ${id}`);
    }

    return bookmark;
  }

  private getFolder(id: string): chrome.bookmarks.BookmarkTreeNode {
    const bookmark = this.getBookmark(id);
    if (!bookmark.children) {
      throw new Error(`Bookmark ${id} is not a folder`);
    }

    return bookmark;
  }

  private getInsertionIndex(index: number|undefined, childCount: number): number {
    if (index === undefined) {
      return childCount;
    }
    if (!Number.isInteger(index) || index < 0 || index > childCount) {
      throw new Error(`Invalid bookmark index: ${index}`);
    }

    return index;
  }

  private reindexChildren(parent: chrome.bookmarks.BookmarkTreeNode): void {
    parent.children!.forEach((child, index) => {
      child.parentId = parent.id;
      child.index = index;
    });
    parent.dateGroupModified = this.nextDate();
  }

  private removeNode(bookmark: chrome.bookmarks.BookmarkTreeNode): void {
    if (!bookmark.parentId) {
      throw new Error('The root bookmark cannot be removed');
    }

    const parent = this.getFolder(bookmark.parentId);
    const index = parent.children!.findIndex(child => child.id === bookmark.id);
    if (index < 0) {
      throw new Error(`Bookmark ${bookmark.id} is detached from its parent`);
    }

    const removedNode = this.clone(bookmark);
    parent.children!.splice(index, 1);
    this.removeFromIndex(bookmark);
    this.reindexChildren(parent);

    const removeInfo: chrome.bookmarks.BookmarkRemoveInfo = {
      parentId: parent.id,
      index,
      node: removedNode
    };
    this.removedEvents.next([bookmark.id, removeInfo]);
  }

  private removeFromIndex(bookmark: chrome.bookmarks.BookmarkTreeNode): void {
    bookmark.children?.forEach(child => this.removeFromIndex(child));
    delete this.flatBookmarksArray[bookmark.id];
  }

  private isDescendant(
    candidateParent: chrome.bookmarks.BookmarkTreeNode,
    ancestorId: string
  ): boolean {
    let current: chrome.bookmarks.BookmarkTreeNode|undefined = candidateParent;
    while (current) {
      if (current.id === ancestorId) {
        return true;
      }
      current = current.parentId ? this.flatBookmarksArray[current.parentId] : undefined;
    }

    return false;
  }

  private nextBookmarkId(): string {
    while (this.flatBookmarksArray[String(this.bookmarkId)]) {
      this.bookmarkId++;
    }

    return String(this.bookmarkId++);
  }

  private nextDate(): number {
    return this.timestamp++;
  }

  private clone<T>(value: T): T {
    return structuredClone(value);
  }
}
