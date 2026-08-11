import { BookmarkSortValueAccessor, OrderByPipe } from './order-by.pipe';

describe('OrderByPipe', () => {
  const pipe = new OrderByPipe();

  function node(
    id: string,
    title: string,
    values: Partial<chrome.bookmarks.BookmarkTreeNode> = {}
  ): chrome.bookmarks.BookmarkTreeNode {
    return { id, title, ...values };
  }

  it('sorts equivalent folder nodes antisymmetrically by the selected value', () => {
    const folders = [
      node('2', 'Beta', { children: [] }),
      node('1', 'Alpha', { children: [] })
    ];

    expect(pipe.transform(folders, { column: 'title', asc: true }).map(item => item.id))
      .toEqual(['1', '2']);
    expect(pipe.transform(folders, { column: 'title', asc: false }).map(item => item.id))
      .toEqual(['2', '1']);
  });

  it('keeps folders before bookmarks while sorting each kind', () => {
    const items = [
      node('bookmark-b', 'Beta', { url: 'https://b.example' }),
      node('folder-b', 'Beta', { children: [] }),
      node('bookmark-a', 'Alpha', { url: 'https://a.example' }),
      node('folder-a', 'Alpha', { children: [] })
    ];

    expect(pipe.transform(items, { column: 'title', asc: true }).map(item => item.id))
      .toEqual(['folder-a', 'folder-b', 'bookmark-a', 'bookmark-b']);
  });

  it('sorts the computed Tags column through its typed accessor', () => {
    const items = [
      node('1', 'First', { url: 'https://first.example' }),
      node('2', 'Second', { url: 'https://second.example' })
    ];
    const tags = new Map([['1', 'Work'], ['2', 'Archive']]);
    const accessor: BookmarkSortValueAccessor = (item, column) =>
      column === 'tags' ? tags.get(item.id) : item[column];

    expect(pipe.transform(items, { column: 'tags', asc: true }, accessor).map(item => item.id))
      .toEqual(['2', '1']);
    expect(pipe.transform(items, { column: 'tags', asc: false }, accessor).map(item => item.id))
      .toEqual(['1', '2']);
  });

  it('places missing dates last in both directions', () => {
    const items = [
      node('missing', 'Missing', { url: 'https://missing.example' }),
      node('old', 'Old', { url: 'https://old.example', dateAdded: 1 }),
      node('new', 'New', { url: 'https://new.example', dateAdded: 2 })
    ];

    expect(pipe.transform(items, { column: 'dateAdded', asc: true }).map(item => item.id))
      .toEqual(['old', 'new', 'missing']);
    expect(pipe.transform(items, { column: 'dateAdded', asc: false }).map(item => item.id))
      .toEqual(['new', 'old', 'missing']);
  });

  it('sorts numeric usefulness scores and keeps unscored bookmarks last', () => {
    const items = [
      node('missing', 'Missing', { url: 'https://missing.example' }),
      node('high', 'High', { url: 'https://high.example' }),
      node('low', 'Low', { url: 'https://low.example' })
    ];
    const scores = new Map([['high', 5], ['low', 1]]);
    const accessor: BookmarkSortValueAccessor = (item, column) =>
      column === 'usefulness' ? scores.get(item.id) : undefined;

    expect(pipe.transform(items, { column: 'usefulness', asc: true }, accessor).map(item => item.id))
      .toEqual(['low', 'high', 'missing']);
    expect(pipe.transform(items, { column: 'usefulness', asc: false }, accessor).map(item => item.id))
      .toEqual(['high', 'low', 'missing']);
  });
});
