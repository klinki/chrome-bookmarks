import { Component, inject } from '@angular/core';
import { BookmarksViewComponent } from "./components";

import { RouterModule } from '@angular/router';
import { SettingsService } from './services/settings.service';

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
  private settingsService = inject(SettingsService);

  constructor() {
  }
}
