/* tslint:disable:no-unused-variable */

import {
  beforeEach, beforeEachProviders,
  describe, xdescribe,
  expect, it, xit,
  async, inject
} from '@angular/core/testing';
import { BookmarkService } from './bookmark.service';

describe('BookmarkService Service', () => {
  beforeEachProviders(() => [BookmarkService]);

  it('should ...',
      inject([BookmarkService], (service: BookmarkService) => {
    expect(service).toBeTruthy();
  }));
});
