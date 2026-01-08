import { Component } from '@angular/core';
import { BookmarksViewComponent } from "./components";

import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.css'],
  imports: [
    RouterModule,
    BookmarksViewComponent,
  ],
})
export class AppComponent {
  constructor() {
  }
}
