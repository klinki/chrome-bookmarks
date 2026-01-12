import { TestBed } from '@angular/core/testing';

import { BookmarksFacadeService } from './bookmarks-facade.service';
import { BookmarksProviderService } from './bookmarks-provider.service';
import { SelectionService } from './selection.service';
import { TagsService } from './tags.service';
import { AiService } from './ai.service';
import { BookmarksStore } from './bookmarks.store';
import { signal } from '@angular/core';

describe('BookmarksFacadeService', () => {
  let service: BookmarksFacadeService;

  const mockBookmarksProvider = {
    onCreatedEvent$: { subscribe: () => {} },
    onRemovedEvent$: { subscribe: () => {} },
    onChangedEvent$: { subscribe: () => {} },
    onMovedEvent$: { subscribe: () => {} },
    onChildrenReorderedEvent$: { subscribe: () => {} },
    onImportBeganEvent$: { subscribe: () => {} },
    onImportEndedEvent$: { subscribe: () => {} },
    getDirectoryTree: jasmine.createSpy('getDirectoryTree').and.returnValue(Promise.resolve([])),
    getBookmarks: jasmine.createSpy('getBookmarks').and.returnValue(Promise.resolve([])),
    search: jasmine.createSpy('search').and.returnValue(Promise.resolve([]))
  };

  const mockSelectionService = {
    items: [],
    itemsSignal: signal([])
  };
  const mockTagsService = {};
  const mockAiService = {};
  const mockStore = {
    loading: signal(false),
    error: signal(null)
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BookmarksFacadeService,
        { provide: BookmarksProviderService, useValue: mockBookmarksProvider },
        { provide: SelectionService, useValue: mockSelectionService },
        { provide: TagsService, useValue: mockTagsService },
        { provide: AiService, useValue: mockAiService },
        { provide: BookmarksStore, useValue: mockStore }
      ]
    });
    service = TestBed.inject(BookmarksFacadeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
