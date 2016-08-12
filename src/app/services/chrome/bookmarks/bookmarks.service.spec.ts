/* tslint:disable:no-unused-variable */

import {
  async, inject, TestBed
} from '@angular/core/testing';
import { BookmarksService } from './bookmarks.service';

describe('Bookmarks Service', () => {
  beforeEach(() => {
     TestBed.configureTestingModule([BookmarksService]);
   });

  it('should ...',
      inject([BookmarksService], (service: BookmarksService) => {
    expect(service).toBeTruthy();
  }));
});
