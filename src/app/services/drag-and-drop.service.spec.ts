import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { DragAndDropService } from './drag-and-drop.service';
import { DropPosition } from './constants';

import { BookmarksFacadeService } from './bookmarks-facade.service';
import { BookmarksProviderService } from './bookmarks-provider.service';
import { SelectionService } from './selection.service';
import { TagsService } from './tags.service';
import { NEVER } from 'rxjs';
import { signal } from '@angular/core';

describe('DragAndDropService', () => {
  let service: DragAndDropService;



  const mockBookmarksFacade = {
    items: signal<chrome.bookmarks.BookmarkTreeNode[]>([]),
    selectedBookmarks: signal<chrome.bookmarks.BookmarkTreeNode[]>([]),
    searchTerm: signal(''),
    bookmarksMap: signal({})
  };

  const mockBookmarksProvider = {
    getBookmarks: vi.fn().mockResolvedValue([]),
    moveMultiple: vi.fn(),
    onCreatedEvent$: NEVER,
    onRemovedEvent$: NEVER,
    onChangedEvent$: NEVER,
    onMovedEvent$: NEVER,
    onChildrenReorderedEvent$: NEVER,
    onImportBeganEvent$: NEVER,
    onImportEndedEvent$: NEVER
  };

  const mockSelectionService = {
    items: [],
    itemsSignal: signal([]),
    selection: signal(new Set()),
    selectedDirectory: signal(null)
  };

  const mockTagsService = {};

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DragAndDropService,

        { provide: BookmarksFacadeService, useValue: mockBookmarksFacade },
        { provide: BookmarksProviderService, useValue: mockBookmarksProvider },
        { provide: SelectionService, useValue: mockSelectionService },
        { provide: TagsService, useValue: mockTagsService }
      ]
    });
    service = TestBed.inject(DragAndDropService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('recognizes list component hosts as bookmark drop targets', () => {
    const list = document.createElement('app-list-view');

    expect(service.getBookmarkElement([list])).toBe(list);
  });

  it('allows dropping onto the selected folder through an empty list host', () => {
    const folder = {
      id: 'target',
      parentId: '1',
      title: 'Target',
      children: []
    };
    const dragged = {
      id: 'bookmark',
      parentId: 'source',
      title: 'Bookmark',
      url: 'https://example.com'
    };
    const list = document.createElement('app-list-view');

    (service as any).selectedFolder = signal(folder);
    (service as any).bookmarksMap = signal({
      '0': { id: '0', title: 'root', children: [] },
      '1': { id: '1', parentId: '0', title: 'Bookmarks Bar', children: [] },
      [folder.id]: folder,
      [dragged.id]: dragged
    });

    expect((service as any).calculateValidDropPositions(list)).toBe(DropPosition.ON);
  });

  it('rejects list and item drop targets while search is active', () => {
    const list = document.createElement('app-list-view');
    const item = document.createElement('tr');
    item.setAttribute('itemid', 'result');
    (service as any).searchTerm = signal('query');

    expect((service as any).calculateValidDropPositions(list)).toBe(DropPosition.NONE);
    expect((service as any).calculateValidDropPositions(item)).toBe(DropPosition.NONE);
  });

  it('waits for failed moves and always clears drag state', async () => {
    vi.useFakeTimers();
    const folder = {
      id: 'target',
      parentId: '1',
      title: 'Target',
      children: []
    };
    const dragged = {
      id: 'bookmark',
      parentId: 'source',
      title: 'Bookmark',
      url: 'https://example.com'
    };
    const list = document.createElement('app-list-view');
    const preventDefault = vi.fn();
    (service as any).selectedFolder = signal(folder);
    (service as any).dropDestination = {
      element: list,
      position: DropPosition.ON
    };
    (service as any).dragInfo.setNativeDragData({
      elements: [dragged],
      sameProfile: true
    });
    (service as any).moveMultipleCallback = vi.fn().mockRejectedValue(new Error('Move failed'));

    await expect((service as any).onDrop({
      composedPath: () => [list],
      preventDefault
    })).rejects.toThrow('Move failed');
    vi.runAllTimers();

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect((service as any).dragInfo.dragData).toBeNull();
    expect((service as any).dropDestination).toBeNull();
    vi.useRealTimers();
  });
});
