import { Component, provide } from '@angular/core';
import {BookmarksViewComponent} from './bookmarks-view';
import {BookmarksProviderService} from './bookmarks-provider.service';
import {MockBookmarksProviderService} from './mock-bookmarks-provider.service';
import {BookmarkService} from './bookmark.service'

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
