import { environment } from "../../environments/environment";
import { BookmarksService, MockBookmarksService } from '../services';

export const BookmarksServiceProvider = (environment.production || (window as any).isE2E)
  ? BookmarksService
  : { provide: BookmarksService, useClass: MockBookmarksService };
