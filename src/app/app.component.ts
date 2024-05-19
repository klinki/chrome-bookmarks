import { Component } from '@angular/core';
import { BookmarksProviderService, SelectionService } from './services';
import { BookmarksServiceProvider } from './shared/providers';
import { BookmarksViewComponent } from "./components";
import {BookmarksFacadeService} from "./services/bookmarks-facade.service";
import {DragAndDropService} from "./services/drag-and-drop.service";

@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.css'],
  imports: [
    BookmarksViewComponent,
  ],
  providers: [
    BookmarksServiceProvider,
    BookmarksProviderService,
    SelectionService,
    BookmarksFacadeService,
    DragAndDropService,
  ]
})
export class AppComponent {
  constructor() {
  }
}
