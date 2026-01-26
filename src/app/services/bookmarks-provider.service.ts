import {inject, Injectable} from '@angular/core';
import { BookmarksService } from './chrome';
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {map} from "rxjs";
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

  public moveMultiple(ids: string[], destination: chrome.bookmarks.BookmarkDestinationArg) {
    const promises = ids.map(x => this.move(x, destination));
    return Promise.all(promises);
  }

  public update(id: string, changes: chrome.bookmarks.BookmarkChangesArg) {
    return this.bookmarksService.update(id, changes);
  }
}

export function injectAllBookmarksMap() {
  const tree = inject(BookmarksProviderService).getBookmarks();
  const getNormalizedTree$ = fromPromise(tree)
    .pipe(map(nodes => {
      const nodeMap: Record<string, chrome.bookmarks.BookmarkTreeNode> = {};
      const stack = [ nodes[0] ];

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
  return toSignal(getNormalizedTree$, { initialValue: emptyRecord });
}

export function injectMoveMultipleBookmarksCallback() {
  const service = inject(BookmarksProviderService);
  return (ids: string[], destination: chrome.bookmarks.BookmarkDestinationArg) => service.moveMultiple(ids, destination);
}
