import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { BookmarksService } from './bookmarks.service';

@Injectable()
export class MockBookmarksService extends BookmarksService {
  /** @deprecated */
  public static MAX_WRITE_OPERATIONS_PER_HOUR = 1000;

  /** @deprecated */
  public static MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE = 10000;

  protected bookmarksTree: chrome.bookmarks.BookmarkTreeNode[];
  protected flatBookmarksArray: { [id: string]: chrome.bookmarks.BookmarkTreeNode } = {};

  public onCreatedEvent;
  public onRemovedEvent;
  public onChangedEvent;
  public onMovedEvent;
  public onChildrenReorderedEvent;
  public onImportBeganEvent;
  public onImportEndedEvent;

  public onCreated;
  public onRemoved;
  public onChanged;
  public onMoved;
  public onChildrenReordered;
  public onImportBegan;
  public onImportEnded;

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
      let shops = this.addDirectory('5', 'E-Shopy', otherBookmarks);

      this.addUrl('3', 'Seznam - najdu tam co neznám', 'http://seznam.cz', toolbarBookmarks);
      this.addUrl('4', 'Google - search', 'http://google.com', otherBookmarks);
      this.addUrl('6', 'Alza.cz - The annoying green alien', 'http://alza.cz', shops);
  }

  protected addDirectory(id: string, title: string, parent: chrome.bookmarks.BookmarkTreeNode, managed?: string) {
      let directory = {
          id: id, 
          title: title,
          managed: managed,
          parentId: null,
          index: null,
          children: []
      };

      if (parent) {
          directory.parentId = parent.id;
          directory.index = parent.children.length;
          parent.children.push(directory);
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
          index: directory.children.length
      };
      directory.children.push(bookmark);
      this.addBookmark(bookmark);

      return bookmark;
  }

  protected getGUID(): string {
      let S4 = () => (((1+Math.random())*0x10000)|0).toString(16).substring(1);
      let guid = (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
      
      return guid;
  }

  protected addBookmark(bookmark: chrome.bookmarks.BookmarkTreeNode) {
      this.flatBookmarksArray[bookmark.id] = bookmark;
  }

  protected initializeEventListeners() {
  }

  public get(bookmarkId: string|string[]): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
      return new Promise((resolve, reject) => {
          let arrayOfIds = [];

          if (typeof bookmarkId !== 'array') {
              arrayOfIds = [bookmarkId];
          } else {
              arrayOfIds = bookmarkId;
          }

          let result = arrayOfIds.map((id) => this.flatBookmarksArray[id]);
 
          return resolve(result);
      });
  }

  public getChildren(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
      return this.get(id).then((bookmark) => bookmark[0].children);
  }

  public getRecent(count: number): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
      return new Promise((resolve, error) => {
        let results: chrome.bookmarks.BookmarkTreeNode[] = [];

        for (let index in this.flatBookmarksArray) {
            results.push(this.flatBookmarksArray[index]);
        }

        results.sort((a, b) => a.dateAdded - b.dateAdded);

        return resolve(results);
      });
  }

  public getTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {   
      return new Promise((resolve, reject) => resolve(this.bookmarksTree));
  }

  public getSubTree(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
      return this.get(id);
  }

  public search(term: string|chrome.bookmarks.BookmarkSearchQuery): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
      return new Promise((resolve, error) => {
          let results =[];

          for (let property in this.flatBookmarksArray) {
              if (this.flatBookmarksArray.hasOwnProperty(property)) {
                  let node = this.flatBookmarksArray[property];

                  if (typeof term == 'string') {
                    if (node.url.indexOf(term as any as string) || node.title.indexOf(term as any as string)) {
                        results.push(node);
                    }
                  } else {
                      let t: chrome.bookmarks.BookmarkSearchQuery;
                      if (node.url.indexOf(t.url) || node.title.indexOf(t.title) || node.url.indexOf(t.query)) {
                          results.push(node);
                      }
                  }
              }
          }
          
          return resolve(results);
      });
  }

  public create(bookmark: chrome.bookmarks.BookmarkCreateArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
      return new Promise((resolve, error) => {
        let parent = this.getBookmark(bookmark.parentId);
        let newBookmark = Object.create(bookmark);
        newBookmark.id = this.getGUID();
        newBookmark.index = parent.children.length;

        parent.children.push(newBookmark);
        this.flatBookmarksArray[newBookmark.id] = newBookmark;
        
        return resolve(newBookmark);
      });
  }

  public move(id: string, destination: chrome.bookmarks.BookmarkDestinationArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
      return new Promise((resolve, error) => {
          let bookmark = this.getBookmark(id);
          let oldParent = this.getBookmark(bookmark.parentId);
          let newParent = this.getBookmark(destination.parentId);

          bookmark.index = destination.index;
          let index = oldParent.children.indexOf(bookmark);
          oldParent.children.splice(index, 1);

          newParent.children.push(bookmark);

          return resolve(bookmark);
      });
  }

  public update(id: string, changes: chrome.bookmarks.BookmarkChangesArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
      return new Promise((resolve, error) => {
          let bookmark = this.getBookmark(id);
          bookmark.title = changes.title;
          bookmark.url = changes.url;

          return resolve(bookmark);
      });
  }

  public remove(id: string): Promise<any> {
      return new Promise((resolve, error) => {
            resolve();

            let child = this.getBookmark(id);
            let parent = this.flatBookmarksArray[child.parentId];
            let index = parent.children.indexOf(child);
            parent.children.splice(index, 1);

            delete this.flatBookmarksArray[id];

            return resolve();
      });
  }

  public removeTree(id: string): Promise<any> {
      return this.remove(id);
  }

  protected getBookmark(id: string): chrome.bookmarks.BookmarkTreeNode {
    if (!this.flatBookmarksArray.hasOwnProperty(id)) {
        throw new Error('Invalid id');
    }

    return this.flatBookmarksArray[id];
  }
}
