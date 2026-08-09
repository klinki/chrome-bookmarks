import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type Mock, vi } from 'vitest';
import { BookmarksProviderService } from './bookmarks-provider.service';
import {
  BookmarksService,
  type BookmarkChangedPayload,
  type BookmarkChildrenReorderedPayload,
  type BookmarkCreatedPayload,
  type BookmarkImportPayload,
  type BookmarkMovedPayload,
  type BookmarkRemovedPayload
} from './chrome/bookmarks/bookmarks.service';
import { Subject } from 'rxjs';
interface MockBookmarksApi {
  onCreatedEvent$: Subject<BookmarkCreatedPayload>;
  onRemovedEvent$: Subject<BookmarkRemovedPayload>;
  onChangedEvent$: Subject<BookmarkChangedPayload>;
  onMovedEvent$: Subject<BookmarkMovedPayload>;
  onChildrenReorderedEvent$: Subject<BookmarkChildrenReorderedPayload>;
  onImportBeganEvent$: Subject<BookmarkImportPayload>;
  onImportEndedEvent$: Subject<BookmarkImportPayload>;
  getTree: Mock;
  getSubTree: Mock;
  search: Mock;
  move: Mock;
}


describe('BookmarksProvider Service', () => {
  const initialTree = [{
    id: '0',
    title: 'root',
    children: [{
      id: '1',
      title: 'Bookmarks Bar',
      parentId: '0',
      children: []
    }]
  }] as unknown as chrome.bookmarks.BookmarkTreeNode[];


  let onCreatedEvent$: Subject<BookmarkCreatedPayload>;
  let onRemovedEvent$: Subject<BookmarkRemovedPayload>;
  let onChangedEvent$: Subject<BookmarkChangedPayload>;
  let onMovedEvent$: Subject<BookmarkMovedPayload>;
  let onChildrenReorderedEvent$: Subject<BookmarkChildrenReorderedPayload>;
  let onImportBeganEvent$: Subject<BookmarkImportPayload>;
  let onImportEndedEvent$: Subject<BookmarkImportPayload>;
  let mockBookmarksService: MockBookmarksApi;


  beforeEach(() => {
    onCreatedEvent$ = new Subject();
    onRemovedEvent$ = new Subject();
    onChangedEvent$ = new Subject();
    onMovedEvent$ = new Subject();
    onChildrenReorderedEvent$ = new Subject();
    onImportBeganEvent$ = new Subject();
    onImportEndedEvent$ = new Subject();

    mockBookmarksService = {
      onCreatedEvent$,
      onRemovedEvent$,
      onChangedEvent$,
      onMovedEvent$,
      onChildrenReorderedEvent$,
      onImportBeganEvent$,
      onImportEndedEvent$,
      getTree: vi.fn().mockResolvedValue(initialTree),
      getSubTree: vi.fn().mockResolvedValue([]),
      search: vi.fn().mockResolvedValue([]),
      move: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        BookmarksProviderService,
        { provide: BookmarksService, useValue: mockBookmarksService }
      ]
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(BookmarksProviderService);
    expect(service).toBeTruthy();
  });


  it('moves bookmarks into another folder sequentially in display order', async () => {
    const service = TestBed.inject(BookmarksProviderService);
    const tree = [{
      id: '0',
      title: 'root',
      children: [
        {
          id: 'source',
          parentId: '1',
          title: 'Source',
          children: [
            { id: 'b', parentId: 'source', title: 'B', url: 'https://b.example' },
            { id: 'c', parentId: 'source', title: 'C', url: 'https://c.example' }
          ]
        },
        {
          id: 'target',
          parentId: '1',
          title: 'Target',
          children: [
            { id: 'x', parentId: 'target', title: 'X', url: 'https://x.example' },
            { id: 'y', parentId: 'target', title: 'Y', url: 'https://y.example' }
          ]
        }
      ]
    }] as chrome.bookmarks.BookmarkTreeNode[];
    mockBookmarksService.getTree.mockReset().mockResolvedValue(tree);
    mockBookmarksService.move.mockImplementation(
      (id: string) => Promise.resolve({ id, title: id.toUpperCase() })
    );

    const result = await service.moveMultiple(['b', 'c'], { parentId: 'target', index: 1 });

    expect(mockBookmarksService.move).toHaveBeenNthCalledWith(1, 'b', {
      parentId: 'target',
      index: 1
    });
    expect(mockBookmarksService.move).toHaveBeenNthCalledWith(2, 'c', {
      parentId: 'target',
      index: 2
    });
    expect(result.map(node => node.id)).toEqual(['b', 'c']);
  });

  it('moves same-folder selections later from the end to preserve their order', async () => {
    const service = TestBed.inject(BookmarksProviderService);
    const children = ['a', 'b', 'c', 'd'].map(id => ({
      id,
      parentId: 'folder',
      title: id.toUpperCase(),
      url: `https://${id}.example`
    }));
    const tree = [{
      id: '0',
      title: 'root',
      children: [{
        id: 'folder',
        parentId: '1',
        title: 'Folder',
        children
      }]
    }] as chrome.bookmarks.BookmarkTreeNode[];
    mockBookmarksService.getTree.mockReset().mockResolvedValue(tree);
    mockBookmarksService.move.mockImplementation(
      (id: string) => Promise.resolve({ id, title: id.toUpperCase() })
    );

    const result = await service.moveMultiple(['b', 'c'], { parentId: 'folder', index: 4 });

    expect(mockBookmarksService.move).toHaveBeenNthCalledWith(1, 'c', {
      parentId: 'folder',
      index: 3
    });
    expect(mockBookmarksService.move).toHaveBeenNthCalledWith(2, 'b', {
      parentId: 'folder',
      index: 2
    });
    expect(result.map(node => node.id)).toEqual(['b', 'c']);
  });
});
