import { environment } from "../../environments/environment.dev";
import { BookmarksService, MockBookmarksService } from '../services';

export const BookmarksServiceProvider = environment.production
  ? BookmarksService
  : { provide: BookmarksService, useClass: MockBookmarksService };
