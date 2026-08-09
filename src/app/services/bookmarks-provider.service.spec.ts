import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type Mock, vi } from 'vitest';
import { BookmarksProviderService, injectAllBookmarksMap } from './bookmarks-provider.service';
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
}

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

  let onCreatedEvent$: Subject<BookmarkCreatedPayload>;
  let onRemovedEvent$: Subject<BookmarkRemovedPayload>;
  let onChangedEvent$: Subject<BookmarkChangedPayload>;
  let onMovedEvent$: Subject<BookmarkMovedPayload>;
  let onChildrenReorderedEvent$: Subject<BookmarkChildrenReorderedPayload>;
  let onImportBeganEvent$: Subject<BookmarkImportPayload>;
  let onImportEndedEvent$: Subject<BookmarkImportPayload>;
  let mockBookmarksService: MockBookmarksApi;

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

    onCreatedEvent$.next([
      '10',
      {
        id: '10',
        title: 'New Folder'
      }
    ]);
    await flushSignalUpdates();

    expect(mockBookmarksService.getTree).toHaveBeenCalledTimes(2);
    expect(consumer.bookmarksMap()['10']).toBeDefined();
    expect(consumer.bookmarksMap()['10']?.title).toBe('New Folder');
  });
});
