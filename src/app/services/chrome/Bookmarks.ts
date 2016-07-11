export interface Bookmarks {
  /** @deprecated */
  MAX_WRITE_OPERATIONS_PER_HOUR: number;
  
  /** @deprecated */
  MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE: number;

  onCreated;
  onRemoved;
  onChanged;
  onMoved;
  onChildrenReordered;
  onImportBegan;
  onImportEnded;

  get(bookmarkId: string|string[]): Promise<chrome.bookmarks.BookmarkTreeNode>;
  getChildren(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]>;
  getRecent(count: number): Promise<chrome.bookmarks.BookmarkTreeNode[]>;
  getTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]>;
  getSubTree(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]>;

  search(term: string|chrome.bookmarks.BookmarkSearchQuery): Promise<chrome.bookmarks.BookmarkTreeNode[]>;

  create(bookmark: chrome.bookmarks.BookmarkCreateArg): Promise<chrome.bookmarks.BookmarkTreeNode[]>;
  move(id: string, destination: chrome.bookmarks.BookmarkDestinationArg): Promise<chrome.bookmarks.BookmarkTreeNode[]>;
  update(id: string, changes: chrome.bookmarks.BookmarkChangesArg): Promise<chrome.bookmarks.BookmarkTreeNode[]> ;
  remove(id: string): Promise<any>;
  removeTree(id: string): Promise<any>;
}
