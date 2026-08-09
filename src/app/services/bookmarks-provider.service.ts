import {inject, Injectable} from '@angular/core';
import { BookmarksService } from './chrome';
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {map, merge, startWith, switchMap} from "rxjs";
import {toSignal} from "@angular/core/rxjs-interop";

@Injectable()
export class BookmarksProviderService {
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
      const moved: chrome.bookmarks.BookmarkTreeNode[] = [];
      for (const id of ids) {
        moved.push(await this.move(id, destination));
      }
      return moved;
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

    const moved = new Array<chrome.bookmarks.BookmarkTreeNode>(ids.length);
    for (const sourceIndex of indexes) {
      moved[sourceIndex] = await this.move(ids[sourceIndex], {
        parentId: destination.parentId,
        index: insertionIndex + sourceIndex
      });
    }
    return moved;
  }

  public update(id: string, changes: chrome.bookmarks.BookmarkChangesArg) {
    return this.bookmarksService.update(id, changes);
  }
}

export function injectAllBookmarksMap() {
  const service = inject(BookmarksProviderService);
  const bookmarksChanged$ = merge(
    service.onCreatedEvent$,
    service.onRemovedEvent$,
    service.onChangedEvent$,
    service.onMovedEvent$,
    service.onChildrenReorderedEvent$,
    service.onImportBeganEvent$,
    service.onImportEndedEvent$
  ).pipe(
    startWith(null),
    switchMap(() => fromPromise(service.getBookmarks())),
    map(nodes => {
      const nodeMap: Record<string, chrome.bookmarks.BookmarkTreeNode> = {};
      const rootNode = nodes[0];

      if (!rootNode) {
        return nodeMap;
      }

      const stack = [ rootNode ];

      while (stack.length > 0) {
        const node = stack.pop()!;
        nodeMap[node.id] = node;
        if (!node.children) {
          continue;
        }

        node.children.forEach(function(child) {
          stack.push(child);
        });
      }

      return nodeMap;
    }));

  const emptyRecord: Record<string, chrome.bookmarks.BookmarkTreeNode> = {};
  return toSignal(bookmarksChanged$, { initialValue: emptyRecord });
}

export function injectMoveMultipleBookmarksCallback() {
  const service = inject(BookmarksProviderService);
  return (ids: string[], destination: chrome.bookmarks.BookmarkDestinationArg) => service.moveMultiple(ids, destination);
}
