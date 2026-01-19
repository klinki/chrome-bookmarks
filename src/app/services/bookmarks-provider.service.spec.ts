import {
  waitForAsync, inject, TestBed
} from '@angular/core/testing';
import { vi } from 'vitest';
import { BookmarksProviderService } from './bookmarks-provider.service';
import { BookmarksService } from './chrome/bookmarks/bookmarks.service';
import { of } from 'rxjs';

describe('BookmarksProvider Service', () => {

  const mockBookmarksService = {
    onCreatedEvent$: of(null),
    onRemovedEvent$: of(null),
    onChangedEvent$: of(null),
    onMovedEvent$: of(null),
    onChildrenReorderedEvent$: of(null),
    onImportBeganEvent$: of(null),
    onImportEndedEvent$: of(null),
    getTree: vi.fn().mockResolvedValue([]),
    getSubTree: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue([])
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ 
      providers: [
        BookmarksProviderService,
        { provide: BookmarksService, useValue: mockBookmarksService }
      ] 
    });
   });

  it('should ...',
      waitForAsync(inject([BookmarksProviderService], (service: BookmarksProviderService) => {
    expect(service).toBeTruthy();
  })));
});
