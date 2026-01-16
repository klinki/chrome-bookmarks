import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService, Theme, Language } from '../../../services/settings.service';

@Component({
  selector: 'app-general-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './general-settings.component.html',
  styleUrls: ['./general-settings.component.css']
})
export class GeneralSettingsComponent {
  settingsService = inject(SettingsService);

  themes: { value: Theme; label: string }[] = [
    { value: 'default', label: 'Default' },
    { value: 'dark', label: 'Dark' }
  ];

  languages: { value: Language; label: string }[] = [
    { value: 'en', label: 'English' }
  ];

  updateTheme(theme: Theme) {
    this.settingsService.setTheme(theme);
  }

  updateLanguage(lang: Language) {
    this.settingsService.setLanguage(lang);
  }
}
