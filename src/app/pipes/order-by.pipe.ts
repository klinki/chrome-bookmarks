import { Pipe, PipeTransform } from '@angular/core';

export interface OrderProperties {
  column: string;
  asc: boolean;
}

@Pipe({
  name: 'orderBy',
  standalone: true,
})
export class OrderByPipe implements PipeTransform {

  transform<T>(items: T[]|null, orderProperties: OrderProperties): T[] {
    console.log('order by pipe');
    return this.orderBy(items, orderProperties) ?? [];
  }

  orderBy(items: any[]|null, orderProperties: OrderProperties) {
    const columnKey = orderProperties.column as keyof chrome.bookmarks.BookmarkTreeNode;
    const order = orderProperties.asc ? 1 : -1;

    return items?.toSorted((a, b) => {
      if (a.url && b.url) {
        if ((a[columnKey] ?? 0) > (b[columnKey] ?? 0)) {
          return order;
        } else if ((a[columnKey] ?? 0) < (b[columnKey] ?? 0)) {
          return -order;
        } else {
          return 0;
        }
      } else if (a.url) {
        return order;
      } else {
        return -order;
      }
    });
  }
}
