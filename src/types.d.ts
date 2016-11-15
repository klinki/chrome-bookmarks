export declare interface BookmarkVisitor {
    visitLeaf(Bookmark): any;
    visitRoot(Bookmark): any;
}

export declare interface Bookmark extends chrome.bookmarks.BookmarkTreeNode {
    accept(BookmarkVisitor): any;
}
