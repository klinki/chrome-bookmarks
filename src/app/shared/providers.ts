import { provide } from '@angular/core';
import { environment } from '../index';
import { BookmarksService, MockBookmarksService } from '../services/index';

export let BookmarksServiceProvider;

if (environment.production) {
    BookmarksServiceProvider = BookmarksService;
} else {
    BookmarksServiceProvider = provide(BookmarksService, {useClass: MockBookmarksService});
}
