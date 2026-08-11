import {inject, Injectable} from '@angular/core';
import { BookmarksService } from './chrome';
import {
  BulkMutationCoordinatorService,
  BulkMutationError
} from './bulk-mutation-coordinator.service';

@Injectable()
export class BookmarksProviderService {
  private readonly bulkMutations = inject(BulkMutationCoordinatorService);
  protected bookmarks: any[] = [];

  public static EmptyDirectory: chrome.bookmarks.BookmarkTreeNode = {
      id: '0',
      title: '',
      children: []
  };

  public static EmptyBookmark = {
      id: '0',
      title: '',
      url: ''
  };

  public onCreatedEvent$ = this.bookmarksService.onCreatedEvent$;
  public onRemovedEvent$ = this.bookmarksService.onRemovedEvent$;
  public onChangedEvent$ = this.bookmarksService.onChangedEvent$;
  public onMovedEvent$ = this.bookmarksService.onMovedEvent$;
  public onChildrenReorderedEvent$ = this.bookmarksService.onChildrenReorderedEvent$;
  public onImportBeganEvent$ = this.bookmarksService.onImportBeganEvent$;
  public onImportEndedEvent$ = this.bookmarksService.onImportEndedEvent$;

  constructor(protected bookmarksService: BookmarksService) {
    this.onMovedEvent$ = this.bookmarksService.onMovedEvent$;
  }

  public getChildren(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return this.bookmarksService.getChildren(id);
  }

  public getBookmarks(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return this.bookmarksService.getTree();
  }

  public search(searchTerm: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return this.bookmarksService.search(searchTerm);
  }

  public create(bookmark: chrome.bookmarks.BookmarkCreateArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
    return this.bookmarksService.create(bookmark);
  }

  public filterDirectories(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode[] {
    return bookmarks.filter((bookmark) => bookmark.url === undefined).map((bookmark) => {
      let newBookmark = Object.create(bookmark);
      newBookmark.children = this.filterDirectories(bookmark.children ?? []);

      return newBookmark;
    });
  }

  public getDirectoryTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return this.getBookmarks().then((bookmarks) => this.filterDirectories(bookmarks));
  }

  public getDirectoryTreeWithoutRoot(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return this.getBookmarks().then((bookmarks) =>
      this.filterDirectories(bookmarks[0].children ?? []));
  }

  public move(id: string, destination: chrome.bookmarks.BookmarkDestinationArg) {
    return this.bookmarksService.move(id, destination);
  }

  public remove(id: string) {
    return this.bookmarksService.remove(id);
  }

  public removeTree(id: string) {
    return this.bookmarksService.removeTree(id);
  }

  public async moveMultiple(ids: string[], destination: chrome.bookmarks.BookmarkDestinationArg) {
    if (ids.length === 0) {
      return [];
    }

    if (destination.index == null || destination.parentId == null) {
      const result = await this.bulkMutations.run({
        operation: 'move-bookmarks',
        items: ids,
        identify: id => id,
        execute: id => this.move(id, destination)
      });
      if (result.cancelled || result.failures.length > 0) {
        throw new BulkMutationError(result);
      }
      return result.results as chrome.bookmarks.BookmarkTreeNode[];
    }

    const tree = await this.getBookmarks();
    const stack = [...tree];
    let destinationFolder: chrome.bookmarks.BookmarkTreeNode | undefined;
    const draggedNodes = new Map<string, chrome.bookmarks.BookmarkTreeNode>();
    const draggedIds = new Set(ids);

    while (stack.length > 0 && (!destinationFolder || draggedNodes.size < draggedIds.size)) {
      const node = stack.pop()!;
      if (node.id === destination.parentId) {
        destinationFolder = node;
      }
      if (draggedIds.has(node.id)) {
        draggedNodes.set(node.id, node);
      }
      if (node.children) {
        stack.push(...node.children);
      }
    }

    const destinationChildren = destinationFolder?.children ?? [];
    const movedBeforeDestination = destinationChildren
      .slice(0, destination.index)
      .filter(node => draggedIds.has(node.id))
      .length;
    const insertionIndex = destination.index - movedBeforeDestination;
    const allFromDestination = ids.every(id => draggedNodes.get(id)?.parentId === destination.parentId);
    const firstSourceIndex = destinationChildren.findIndex(node => draggedIds.has(node.id));
    const indexes = ids.map((_, index) => index);

    if (allFromDestination && firstSourceIndex !== -1 && insertionIndex > firstSourceIndex) {
      indexes.reverse();
    }

    const operations = indexes.map(sourceIndex => ({
      id: ids[sourceIndex],
      sourceIndex,
      destination: {
        parentId: destination.parentId,
        index: insertionIndex + sourceIndex
      }
    }));
    const result = await this.bulkMutations.run({
      operation: 'move-bookmarks',
      items: operations,
      identify: operation => operation.id,
      execute: operation => this.move(operation.id, operation.destination)
    });
    if (result.cancelled || result.failures.length > 0) {
      throw new BulkMutationError(result);
    }
    const moved = new Array<chrome.bookmarks.BookmarkTreeNode>(ids.length);
    operations.forEach((operation, index) => {
      moved[operation.sourceIndex] = result.results[index]!;
    });
    return moved;
  }

  public update(id: string, changes: chrome.bookmarks.BookmarkChangesArg) {
    return this.bookmarksService.update(id, changes);
  }
}


export function injectMoveMultipleBookmarksCallback() {
  const service = inject(BookmarksProviderService);
  return (ids: string[], destination: chrome.bookmarks.BookmarkDestinationArg) => service.moveMultiple(ids, destination);
}
