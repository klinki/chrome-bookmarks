import {Injectable} from '@angular/core';
import {fromEventPattern, Observable, Subject} from 'rxjs';

export type BookmarkCreatedPayload = [id: string, bookmark: chrome.bookmarks.BookmarkTreeNode];
export type BookmarkRemovedPayload = [id: string, removeInfo: chrome.bookmarks.BookmarkRemoveInfo];
export type BookmarkChangedPayload = [id: string, changeInfo: chrome.bookmarks.BookmarkChangeInfo];
export type BookmarkMovedPayload = [id: string, moveInfo: chrome.bookmarks.BookmarkMoveInfo];
export type BookmarkChildrenReorderedPayload = [id: string, reorderInfo: chrome.bookmarks.BookmarkReorderInfo];
export type BookmarkImportPayload = [];

const fromChromeEventPattern = <T, U extends (...args: never[]) => void>(
  source: chrome.events.Event<U>
) => fromEventPattern<T>(
  (handler) => source.addListener(handler as unknown as U),
  (handler) => source.removeListener(handler as unknown as U)
);


/**
 * Google Chrome Bookmarks Service
 *
 * @class BookmarksService
 */
@Injectable()
export class BookmarksService {
  public onCreatedEvent$: Observable<BookmarkCreatedPayload>;
  public onRemovedEvent$: Observable<BookmarkRemovedPayload>;
  public onChangedEvent$: Observable<BookmarkChangedPayload>;
  public onMovedEvent$: Observable<BookmarkMovedPayload>;
  public onChildrenReorderedEvent$: Observable<BookmarkChildrenReorderedPayload>;
  public onImportBeganEvent$: Observable<BookmarkImportPayload>;
  public onImportEndedEvent$: Observable<BookmarkImportPayload>;

  constructor() {
    if (chrome.bookmarks) {
      this.onCreatedEvent$ = fromChromeEventPattern<
        BookmarkCreatedPayload,
        (id: string, bookmark: chrome.bookmarks.BookmarkTreeNode) => void
      >(chrome.bookmarks.onCreated);
      this.onRemovedEvent$ = fromChromeEventPattern<
        BookmarkRemovedPayload,
        (id: string, removeInfo: chrome.bookmarks.BookmarkRemoveInfo) => void
      >(chrome.bookmarks.onRemoved);
      this.onChangedEvent$ = fromChromeEventPattern<
        BookmarkChangedPayload,
        (id: string, changeInfo: chrome.bookmarks.BookmarkChangeInfo) => void
      >(chrome.bookmarks.onChanged);
      this.onMovedEvent$ = fromChromeEventPattern<
        BookmarkMovedPayload,
        (id: string, moveInfo: chrome.bookmarks.BookmarkMoveInfo) => void
      >(chrome.bookmarks.onMoved);
      this.onChildrenReorderedEvent$ = fromChromeEventPattern<
        BookmarkChildrenReorderedPayload,
        (id: string, reorderInfo: chrome.bookmarks.BookmarkReorderInfo) => void
      >(chrome.bookmarks.onChildrenReordered);
      this.onImportBeganEvent$ = fromChromeEventPattern<BookmarkImportPayload, () => void>(
        chrome.bookmarks.onImportBegan
      );
      this.onImportEndedEvent$ = fromChromeEventPattern<BookmarkImportPayload, () => void>(
        chrome.bookmarks.onImportEnded
      );
    } else {
      this.onCreatedEvent$ = new Subject();
      this.onRemovedEvent$ = new Subject();
      this.onChangedEvent$ = new Subject();
      this.onMovedEvent$ = new Subject();
      this.onChildrenReorderedEvent$ = new Subject();
      this.onImportBeganEvent$ = new Subject();
      this.onImportEndedEvent$ = new Subject();
    }
  }

  /**
   * Retrieves the specified BookmarkTreeNode.
   *
   * @param {(string|string[])} bookmarkId An array of string-valued ids or single string-valued id
   * @returns {Promise<chrome.bookmarks.BookmarkTreeNode[]>}
   */
  public get(bookmarkId: string|string[]): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return Array.isArray(bookmarkId)
      ? chrome.bookmarks.get(bookmarkId)
      : chrome.bookmarks.get(bookmarkId);
  }

  /**
   * Retrieves the children of the specified BookmarkTreeNode id.
   *
   * @param {string} id
   * @returns {Promise<chrome.bookmarks.BookmarkTreeNode[]>}
   */
  public getChildren(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return chrome.bookmarks.getChildren(id);
  }

  /**
   * Retrieves the recently added bookmarks.
   *
   * @param {number} count The maximum number of items to return.
   * @returns {Promise<chrome.bookmarks.BookmarkTreeNode[]>}
   */
  public getRecent(count: number): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return chrome.bookmarks.getRecent(count);
  }

  /**
   * Retrieves the entire Bookmarks hierarchy.
   *
   * @returns {Promise<chrome.bookmarks.BookmarkTreeNode[]>}
   */
  public getTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return chrome.bookmarks.getTree();
  }

  /**
	 * Since Chrome 14.
	 * Retrieves part of the Bookmarks hierarchy, starting at the specified node.
   *
   * @param {string} id The ID of the root of the subtree to retrieve.
   * @returns {Promise<chrome.bookmarks.BookmarkTreeNode[]>}
   */
  public getSubTree(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return chrome.bookmarks.getSubTree(id);
  }

	/**
   * Searches for BookmarkTreeNodes matching the given query. Queries specified with an object produce BookmarkTreeNodes matching all specified properties.
   *
   * @returns {Promise<chrome.bookmarks.BookmarkTreeNode[]}
   * @param term
   */
  public search(term: string|chrome.bookmarks.BookmarkSearchQuery): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return typeof term === 'string'
      ? chrome.bookmarks.search(term)
      : chrome.bookmarks.search(term);
  }

  /**
   * Creates a bookmark or folder under the specified parentId. If url is NULL or missing, it will be a folder.
   *
   * @param {chrome.bookmarks.BookmarkCreateArg} bookmark
   * @returns {Promise<chrome.bookmarks.BookmarkTreeNode>}
   */
  public create(bookmark: chrome.bookmarks.BookmarkCreateArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
    return chrome.bookmarks.create(bookmark);
  }

  /**
   * Moves the specified BookmarkTreeNode to the provided location.
   *
   * @param {string} id
   * @param {chrome.bookmarks.BookmarkDestinationArg} destination
   * @returns {Promise<chrome.bookmarks.BookmarkTreeNode>}
   */
  public move(id: string, destination: chrome.bookmarks.BookmarkDestinationArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
    return chrome.bookmarks.move(id, destination);
  }

  /**
   * Updates the properties of a bookmark or folder. Specify only the properties that you want to change;
   * unspecified properties will be left unchanged.
   * Note: Currently, only 'title' and 'url' are supported.
   *
   * @param {string} id
   * @param {chrome.bookmarks.BookmarkChangesArg} changes
   * @returns {Promise<chrome.bookmarks.BookmarkTreeNode>}
   */
  public update(id: string, changes: chrome.bookmarks.BookmarkChangesArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
    return chrome.bookmarks.update(id, changes);
  }


  /**
   * Removes a bookmark or an empty bookmark folder.
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  public remove(id: string): Promise<void> {
    return chrome.bookmarks.remove(id);
  }


  /**
   * Recursively removes a bookmark folder.
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  public removeTree(id: string): Promise<void> {
    return chrome.bookmarks.removeTree(id);
  }
}
