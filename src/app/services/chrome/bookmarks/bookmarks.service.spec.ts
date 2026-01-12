/* tslint:disable:no-unused-variable */

import { waitForAsync, inject, TestBed } from '@angular/core/testing';
import { BookmarksService } from './bookmarks.service';

describe('Bookmarks Service', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [BookmarksService] });
   });

  it('should ...',
    waitForAsync(inject([BookmarksService], (service: BookmarksService) => {
      expect(service).toBeTruthy();
    })));
});
