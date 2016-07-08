import { Component, provide } from '@angular/core';
import { BookmarksViewComponent } from './components/index';
import { BookmarksProviderService, MockBookmarksProviderService, BookmarkService } from './services/index';

@Component({
  moduleId: module.id,
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.css'],
  directives: [BookmarksViewComponent],
  providers: [
    BookmarkService,
    BookmarksProviderService,
//    provide(BookmarksProviderService, {useClass: MockBookmarksProviderService})
  ]
})
export class AppComponent {
  title = 'app works!';
}
