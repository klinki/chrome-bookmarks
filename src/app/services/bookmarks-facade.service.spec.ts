import { TestBed } from '@angular/core/testing';

import { BookmarksFacadeService } from './bookmarks-facade.service';

describe('BookmarksFacadeService', () => {
  let service: BookmarksFacadeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BookmarksFacadeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
