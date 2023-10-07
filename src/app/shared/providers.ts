import { environment } from '../index';
import { BookmarksService, MockBookmarksService } from '../services';

export const BookmarksServiceProvider = environment.production
  ? BookmarksService
  : { provide: BookmarksService, useClass: MockBookmarksService };
