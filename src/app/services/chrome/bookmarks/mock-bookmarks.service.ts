import { Injectable } from '@angular/core';
import { BookmarksService } from './bookmarks.service';
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {BookmarkRemovedEvent} from "../../../types";
import {BookmarkDirectory} from "../../../components";

@Injectable()
export class MockBookmarksService extends BookmarksService {
  public override onCreatedEvent$: Observable<chrome.bookmarks.BookmarkCreatedEvent> = new Subject();
  public override onRemovedEvent$: Observable<chrome.bookmarks.BookmarkRemovedEvent> = new Subject();
  public override onChangedEvent$: Observable<chrome.bookmarks.BookmarkChangedEvent> = new Subject();
  public override onMovedEvent$: Observable<chrome.bookmarks.BookmarkMovedEvent> = new Subject();
  public override onChildrenReorderedEvent$: Observable<chrome.bookmarks.BookmarkChildrenReordered> = new Subject();
  public override onImportBeganEvent$: Observable<chrome.bookmarks.BookmarkImportBeganEvent> = new Subject();
  public override onImportEndedEvent$: Observable<chrome.bookmarks.BookmarkImportEndedEvent> = new Subject();

  protected bookmarksTree: chrome.bookmarks.BookmarkTreeNode[];
  protected flatBookmarksArray: { [id: string]: chrome.bookmarks.BookmarkTreeNode } = {};

  bookmarkId = 0;

  constructor() {
      super();

      this.bookmarksTree = [
          {
              id: '0',
              title: 'Root',
              unmodifiable: 'managed',
              children: [
                {
                    id: '1',
                    index: 0,
                    parentId: '0',
                    title: 'Bookmarks Toolbar',
                    unmodifiable: 'managed',
                    children: [
                        {
                            id: '3',
                            index: 0,
                            parentId: '1',
                            url: "http://seznam.cz",
                            title: "Seznam - najdu tam co neznám"
                        }
                    ]
                },
                {
                    id: '2',
                    index: 1,
                    parentId: '0',
                    title: 'Other Bookmarks',
                    unmodifiable: 'managed',
                    children: [
                        {
                            id: '4',
                            index: 0,
                            parentId: '2',
                            url: "http://google.com",
                            title: "Google - search"
                        },
                        {
                            id: '5',
                            index: 1,
                            parentId: '2',
                            title: "E-shopy",
                            children: [
                                {
                                    id: '6',
                                    index: 0,
                                    parentId: '5',
                                    url: "http://alza.cz",
                                    title: "Alza.cz - The annoying green alien"
                                }
                            ]
                        },
                    ]
                },
              ]
          },
      ];

      let root = this.addDirectory('0', 'root', null, 'managed');
      let toolbarBookmarks = this.addDirectory('1', 'Bookmarks Toolbar', root, 'managed');
      let otherBookmarks = this.addDirectory('2', 'Other Bookmarks', root, 'managed');
      let shops = this.addDirectory('3', 'E-Shopy', otherBookmarks);

      this.bookmarksTree = [ root ];
      this.bookmarkId = 4;

      this.generateRandomTree(5, 5, root);

      const countDirs = Object.keys(this.flatBookmarksArray).length;

      for (let i = 0; i < 2000; i++) {
        const randomNumber = Math.floor(Math.random() * countDirs);
        const folder = this.flatBookmarksArray[randomNumber.toString()];
        this.addUrl((this.bookmarkId++).toString(), `Random ${i}`, 'https://centrum.cz', folder);
      }

      this.addUrl((this.bookmarkId++).toString(), 'Seznam - najdu tam co neznám', 'http://seznam.cz', toolbarBookmarks);
      this.addUrl((this.bookmarkId++).toString(), 'Google - search', 'http://google.com', otherBookmarks);
      this.addUrl((this.bookmarkId++).toString(), 'Alza.cz - The annoying green alien', 'http://alza.cz', shops);
      this.addUrl((this.bookmarkId++).toString(), 'Centrum.cz - centrum vesmíru', 'http://centrum.cz', toolbarBookmarks);
  }

  generateRandomTree(depth: number, maxChildren: number, root: any = null) {
    if (depth <= 0) {
      return null;
    }

    const node = this.addDirectory((this.bookmarkId++).toString(), `Directory ${this.bookmarkId}`, root);
    const numChildren = Math.floor(Math.random() * (maxChildren + 1));
    for (let i = 0; i < numChildren; i++) {
      const child = this.generateRandomTree(depth - 1, maxChildren, node);
    }

    return node;
  }

  protected addDirectory(id: string, title: string, parent: chrome.bookmarks.BookmarkTreeNode|null, managed?: string) {
      let directory: chrome.bookmarks.BookmarkTreeNode = {
          id: id,
          title: title,
          parentId: undefined,
          index: undefined,
          children: []
      };

      if (parent != null) {
          directory.parentId = parent.id;
          directory.index = parent?.children?.length ?? undefined;
          parent?.children?.push(directory);
      }

      this.addBookmark(directory);

      return directory;
  }

  protected addUrl(id: string, title: string, url: string, directory: chrome.bookmarks.BookmarkTreeNode) {
      let bookmark = {
          id: id,
          title: title,
          url: url,
          parentId: directory.id,
          index: directory?.children?.length
      };
      directory?.children?.push(bookmark);
      this.addBookmark(bookmark);

      return bookmark;
  }

  protected getGUID(): string {
      let S4 = () => (((1+Math.random())*0x10000)|0).toString(16).substring(1);
      let guid = (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();

      return guid;
  }

  protected addBookmark(bookmark: chrome.bookmarks.BookmarkTreeNode) {
      // Object.freeze(bookmark);
      this.flatBookmarksArray[bookmark.id] = bookmark;
  }

  public override get(bookmarkId: string|string[]): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
      return new Promise((resolve, reject) => {
          const arrayOfIds = Array.isArray(bookmarkId) ? bookmarkId : [ bookmarkId ];
          let result = arrayOfIds.map((id) => this.flatBookmarksArray[id]);

          return resolve(result);
      });
  }

  public override async getChildren(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    const bookmark = await this.get(id);
    return bookmark[0]?.children ?? [];
  }

  public override getRecent(count: number): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
      return new Promise((resolve, error) => {
        let results: chrome.bookmarks.BookmarkTreeNode[] = [];

        for (let index in this.flatBookmarksArray) {
            results.push(this.flatBookmarksArray[index]);
        }

        results.sort((a, b) => (a.dateAdded ?? 0) - (b.dateAdded ?? 0));

        return resolve(results);
      });
  }

  public override getTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
      return new Promise((resolve, reject) => resolve(this.bookmarksTree));
  }

  public override getSubTree(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
      return this.get(id);
  }

  public override search(term: string|chrome.bookmarks.BookmarkSearchQuery): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
      return new Promise((resolve, error) => {
          let results =[];

          for (let property in this.flatBookmarksArray) {
              if (this.flatBookmarksArray.hasOwnProperty(property)) {
                  let node = this.flatBookmarksArray[property];

                  if (typeof term == 'string') {
                    if (node.url?.indexOf(term as any as string) !== -1 || node.title.indexOf(term as any as string) !== -1) {
                        results.push(node);
                    }
                  } else {
                      const t = term as chrome.bookmarks.BookmarkSearchQuery;
                      if (node.url?.indexOf(t.url ?? '') !== -1 || node.title.indexOf(t.title ?? '') !== -1 || node.url?.indexOf(t.query ?? '') !== -1) {
                          results.push(node);
                      }
                  }
              }
          }

          return resolve(results);
      });
  }

  public override create(bookmark: chrome.bookmarks.BookmarkCreateArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
      return new Promise((resolve, error) => {
        let parent = this.getBookmark(bookmark.parentId ?? '');
        let newBookmark = Object.create(bookmark);
        newBookmark.id = this.getGUID();
        newBookmark.index = parent.children?.length ?? -1;

        parent.children?.push(newBookmark);
        this.flatBookmarksArray[newBookmark.id] = newBookmark;

        return resolve(newBookmark);
      });
  }

  public override move(id: string, destination: chrome.bookmarks.BookmarkDestinationArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
      return new Promise((resolve, error) => {
          let bookmark = this.getBookmark(id);
          let oldParent = this.getBookmark(bookmark.parentId ?? '');
          let newParent = this.getBookmark(destination.parentId ?? '');

          bookmark.index = destination.index;
          let index = oldParent.children?.indexOf(bookmark) ?? -1;
          oldParent.children?.splice(index, 1);
          newParent.children?.push(bookmark);

          return resolve(bookmark);
      });
  }

  public override update(id: string, changes: chrome.bookmarks.BookmarkChangesArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
      return new Promise((resolve, error) => {
          let bookmark = this.getBookmark(id);
          bookmark.title = changes.title!;
          bookmark.url = changes.url;

          return resolve(bookmark);
      });
  }

  public override remove(id: string): Promise<any> {
      return new Promise((resolve, error) => {
            resolve(null);

            let child = this.getBookmark(id);
            let parent = this.flatBookmarksArray[child.parentId!];
            let index = parent.children?.indexOf(child) ?? -1;
            parent.children?.splice(index, 1);

            delete this.flatBookmarksArray[id];

            return resolve(null);
      });
  }

  public override removeTree(id: string): Promise<any> {
      return this.remove(id);
  }

  protected getBookmark(id: string): chrome.bookmarks.BookmarkTreeNode {
    if (!this.flatBookmarksArray.hasOwnProperty(id)) {
        throw new Error('Invalid id');
    }

    return this.flatBookmarksArray[id];
  }
}



