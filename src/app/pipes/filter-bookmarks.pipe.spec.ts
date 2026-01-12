/* tslint:disable:no-unused-variable */

import {
  waitForAsync, inject, TestBed
} from '@angular/core/testing';
import { FilterBookmarksPipe } from './filter-bookmarks.pipe';

describe('FilterBookmarks Pipe', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FilterBookmarksPipe]
    });
  });

  it('should create an instance', inject([FilterBookmarksPipe], (pipe: FilterBookmarksPipe) => {
    expect(pipe).toBeTruthy();
  }));
});
