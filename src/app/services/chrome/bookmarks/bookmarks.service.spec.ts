/* tslint:disable:no-unused-variable */

import {
  beforeEach, beforeEachProviders,
  describe, xdescribe,
  expect, it, xit,
  async, inject
} from '@angular/core/testing';
import { BookmarksService } from './bookmarks.service';

describe('Bookmarks Service', () => {
  beforeEachProviders(() => [BookmarksService]);

  it('should ...',
      inject([BookmarksService], (service: BookmarksService) => {
    expect(service).toBeTruthy();
  }));
});
