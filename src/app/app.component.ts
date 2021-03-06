import { Component, provide } from '@angular/core';
import { BookmarksViewComponent } from './components/index';
import { BookmarksProviderService, SelectionService, MockBookmarksService, BookmarksService } from './services/index';
import { BookmarksServiceProvider } from './shared/providers';

@Component({
  moduleId: module.id,
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.css'],
  directives: [BookmarksViewComponent],
  providers: [
//    MockBookmarksService,
//    BookmarksService,
    BookmarksServiceProvider,
    BookmarksProviderService,
    SelectionService
  ]
})
export class AppComponent {
  title = 'app works!';
}
