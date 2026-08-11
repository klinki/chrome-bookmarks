export function createBookmarkFixture(count: number): chrome.bookmarks.BookmarkTreeNode[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `bookmark-${index}`,
    parentId: `folder-${index % 100}`,
    index,
    title: `Bookmark ${String(count - index).padStart(6, '0')}`,
    url: `https://host-${index % 250}.example/path/${index}?item=${index}`,
    dateAdded: 1_700_000_000_000 + index
  }));
}
