import { Component } from '@angular/core';
import { BookmarksProviderService, SelectionService } from './services';
import { BookmarksServiceProvider } from './shared/providers';
import { BookmarksViewComponent } from "./components";
import {DragulaModule} from "ng2-dragula";

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
  ]
})
export class AppComponent {
  constructor() {
  }
}
