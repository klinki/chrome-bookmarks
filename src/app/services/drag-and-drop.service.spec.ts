import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { DragAndDropService } from './drag-and-drop.service';
import { DragulaService } from 'ng2-dragula';
import { BookmarksFacadeService } from './bookmarks-facade.service';
import { BookmarksProviderService } from './bookmarks-provider.service';
import { SelectionService } from './selection.service';
import { TagsService } from './tags.service';
import { signal } from '@angular/core';

describe('DragAndDropService', () => {
  let service: DragAndDropService;

  const mockDragulaService = {
    createGroup: vi.fn(),
    find: vi.fn().mockReturnValue(undefined)
  };

  const mockBookmarksFacade = {
    displayedItems: signal([])
  };

  const mockBookmarksProvider = {
    bookmarksMap: signal({}),
    getBookmarks: vi.fn().mockResolvedValue([])
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
        { provide: DragulaService, useValue: mockDragulaService },
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
});
