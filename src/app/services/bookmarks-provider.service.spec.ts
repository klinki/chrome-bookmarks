/* tslint:disable:no-unused-variable */

import {
  async, inject, TestBed
} from '@angular/core/testing';
import { BookmarksProviderService } from './bookmarks-provider.service';

describe('BookmarksProvider Service', () => {
  beforeEach(() => {
     TestBed.configureTestingModule([BookmarksProviderService]);
   });

  it('should ...',
      inject([BookmarksProviderService], (service: BookmarksProviderService) => {
    expect(service).toBeTruthy();
  }));
});
