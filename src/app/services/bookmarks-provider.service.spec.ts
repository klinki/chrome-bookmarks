/* tslint:disable:no-unused-variable */

import {
  beforeEach, beforeEachProviders,
  describe, xdescribe,
  expect, it, xit,
  async, inject
} from '@angular/core/testing';
import { BookmarksProviderService } from './bookmarks-provider.service';

describe('BookmarksProvider Service', () => {
  beforeEachProviders(() => [BookmarksProviderService]);

  it('should ...',
      inject([BookmarksProviderService], (service: BookmarksProviderService) => {
    expect(service).toBeTruthy();
  }));
});
