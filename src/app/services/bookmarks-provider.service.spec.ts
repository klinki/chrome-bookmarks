import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { BookmarksProviderService, injectAllBookmarksMap } from './bookmarks-provider.service';
import { BookmarksService } from './chrome/bookmarks/bookmarks.service';
import { Subject } from 'rxjs';

@Injectable()
class BookmarksMapConsumer {
  readonly bookmarksMap = injectAllBookmarksMap();
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

  const updatedTree = [{
    id: '0',
    title: 'root',
    children: [{
      id: '1',
      title: 'Bookmarks Bar',
      parentId: '0',
      children: [{
        id: '10',
        title: 'New Folder',
        parentId: '1',
        children: []
      }]
    }]
  }] as unknown as chrome.bookmarks.BookmarkTreeNode[];

  let onCreatedEvent$: Subject<chrome.bookmarks.BookmarkCreatedEvent>;
  let onRemovedEvent$: Subject<chrome.bookmarks.BookmarkRemovedEvent>;
  let onChangedEvent$: Subject<chrome.bookmarks.BookmarkChangedEvent>;
  let onMovedEvent$: Subject<chrome.bookmarks.BookmarkMovedEvent>;
  let onChildrenReorderedEvent$: Subject<chrome.bookmarks.BookmarkChildrenReordered>;
  let onImportBeganEvent$: Subject<chrome.bookmarks.BookmarkImportBeganEvent>;
  let onImportEndedEvent$: Subject<chrome.bookmarks.BookmarkImportEndedEvent>;
  let mockBookmarksService: any;

  const flushSignalUpdates = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

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
      getTree: vi.fn()
        .mockResolvedValueOnce(initialTree)
        .mockResolvedValue(updatedTree),
      getSubTree: vi.fn().mockResolvedValue([]),
      search: vi.fn().mockResolvedValue([])
    };

    TestBed.configureTestingModule({
      providers: [
        BookmarksProviderService,
        BookmarksMapConsumer,
        { provide: BookmarksService, useValue: mockBookmarksService }
      ]
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(BookmarksProviderService);
    expect(service).toBeTruthy();
  });

  it('refreshes the bookmarks map after create events', async () => {
    const consumer = TestBed.inject(BookmarksMapConsumer);
    await flushSignalUpdates();

    expect(consumer.bookmarksMap()['10']).toBeUndefined();

    onCreatedEvent$.next({
      id: '10',
      bookmark: {
        id: '10',
        title: 'New Folder'
      } as chrome.bookmarks.BookmarkTreeNode
    } as chrome.bookmarks.BookmarkCreatedEvent);
    await flushSignalUpdates();

    expect(mockBookmarksService.getTree).toHaveBeenCalledTimes(2);
    expect(consumer.bookmarksMap()['10']).toBeDefined();
    expect(consumer.bookmarksMap()['10']?.title).toBe('New Folder');
  });
});
