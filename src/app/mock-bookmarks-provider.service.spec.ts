/* tslint:disable:no-unused-variable */

import {
  beforeEach, beforeEachProviders,
  describe, xdescribe,
  expect, it, xit,
  async, inject
} from '@angular/core/testing';
import { MockBookmarksProviderService } from './mock-bookmarks-provider.service';

describe('MockBookmarksProvider Service', () => {
  beforeEachProviders(() => [MockBookmarksProviderService]);

  it('should ...',
      inject([MockBookmarksProviderService], (service: MockBookmarksProviderService) => {
    expect(service).toBeTruthy();
  }));
});
