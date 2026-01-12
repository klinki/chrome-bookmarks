import {
  waitForAsync, inject, TestBed
} from '@angular/core/testing';
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
    getTree: jasmine.createSpy('getTree').and.returnValue(Promise.resolve([])),
    getSubTree: jasmine.createSpy('getSubTree').and.returnValue(Promise.resolve([])),
    search: jasmine.createSpy('search').and.returnValue(Promise.resolve([]))
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
