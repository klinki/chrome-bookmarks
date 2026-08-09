import { Pipe, PipeTransform } from '@angular/core';

export const BOOKMARK_SORT_COLUMNS = ['title', 'url', 'dateAdded', 'dateLastUsed', 'tags'] as const;
export type BookmarkSortColumn = typeof BOOKMARK_SORT_COLUMNS[number];
export type BookmarkSortValue = string | number | undefined;
export type BookmarkSortValueAccessor = (
  item: chrome.bookmarks.BookmarkTreeNode,
  column: BookmarkSortColumn
) => BookmarkSortValue;

export interface OrderProperties {
  column: BookmarkSortColumn | '';
  asc: boolean;
}

@Pipe({
  name: 'orderBy',
  standalone: true,
})
export class OrderByPipe implements PipeTransform {

  transform(
    items: chrome.bookmarks.BookmarkTreeNode[] | null,
    orderProperties: OrderProperties,
    valueAccessor: BookmarkSortValueAccessor = this.defaultValueAccessor
  ): chrome.bookmarks.BookmarkTreeNode[] {
    return this.orderBy(items, orderProperties, valueAccessor) ?? [];
  }

  orderBy(
    items: chrome.bookmarks.BookmarkTreeNode[] | null,
    orderProperties: OrderProperties,
    valueAccessor: BookmarkSortValueAccessor = this.defaultValueAccessor
  ): chrome.bookmarks.BookmarkTreeNode[] | undefined {
    if (!orderProperties.column) {
      return items?.toSorted((a, b) => this.compareNodeKinds(a, b));
    }

    const direction = orderProperties.asc ? 1 : -1;
    return items?.toSorted((a, b) => {
      const kindOrder = this.compareNodeKinds(a, b);
      if (kindOrder !== 0) {
        return kindOrder;
      }

      const left = valueAccessor(a, orderProperties.column as BookmarkSortColumn);
      const right = valueAccessor(b, orderProperties.column as BookmarkSortColumn);
      if (left == null || right == null) {
        if (left == null && right == null) {
          return 0;
        }
        return left == null ? 1 : -1;
      }

      const valueOrder = typeof left === 'number' && typeof right === 'number'
        ? Math.sign(left - right)
        : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
      return valueOrder * direction;
    });
  }

  private readonly defaultValueAccessor: BookmarkSortValueAccessor = (item, column) => {
    if (column === 'tags') {
      return '';
    }
    return this.getNativeColumnValue(item, column);
  };

  private getNativeColumnValue(
    item: chrome.bookmarks.BookmarkTreeNode,
    column: Exclude<BookmarkSortColumn, 'tags'>
  ): string | number | undefined {
    if (column === 'dateLastUsed') {
      return (item as chrome.bookmarks.BookmarkTreeNode & { dateLastUsed?: number }).dateLastUsed;
    }

    return item[column];
  }

  private compareNodeKinds(
    left: chrome.bookmarks.BookmarkTreeNode,
    right: chrome.bookmarks.BookmarkTreeNode
  ): number {
    const leftIsFolder = left.url == null;
    const rightIsFolder = right.url == null;
    return leftIsFolder === rightIsFolder ? 0 : leftIsFolder ? -1 : 1;
  }
}
