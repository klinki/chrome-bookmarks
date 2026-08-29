import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SettingsService } from './services/settings.service';

@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    RouterModule,
  ],
})
export class AppComponent {
  private settingsService = inject(SettingsService);

}
