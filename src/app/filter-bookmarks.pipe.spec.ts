/* tslint:disable:no-unused-variable */

import {
  beforeEach, beforeEachProviders,
  describe, xdescribe,
  expect, it, xit,
  async, inject
} from '@angular/core/testing';
import { FilterBookmarksPipe } from './filter-bookmarks.pipe';

describe('Pipe: FilterBookmarks', () => {
  it('create an instance', () => {
    let pipe = new FilterBookmarksPipe();
    expect(pipe).toBeTruthy();
  });
});
