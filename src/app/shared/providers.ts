import { environment } from "../../environments/environment";
import { BookmarksService, MockBookmarksService } from '../services';

export const BookmarksServiceProvider = environment.production
  ? BookmarksService
  : { provide: BookmarksService, useClass: MockBookmarksService };
