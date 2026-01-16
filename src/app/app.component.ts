import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SettingsService } from './services/settings.service';

@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.css'],
  imports: [
    RouterModule,
  ],
})
export class AppComponent {
  private settingsService = inject(SettingsService);

  constructor() {
  }
}
