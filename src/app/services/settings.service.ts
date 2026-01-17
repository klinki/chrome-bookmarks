import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'default' | 'dark';
export type Language = 'en';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  readonly theme = signal<Theme>('default');
  readonly language = signal<Language>('en');

  constructor() {
    // Load from local storage
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme && (savedTheme === 'default' || savedTheme === 'dark')) {
      this.theme.set(savedTheme);
    }

    const savedLang = localStorage.getItem('language') as Language;
    if (savedLang && (savedLang === 'en')) {
      this.language.set(savedLang);
    }

    // Persist changes
    effect(() => {
      localStorage.setItem('theme', this.theme());
      document.body.classList.remove('default-theme', 'dark-theme');
      document.body.classList.add(`${this.theme()}-theme`);
    });

    effect(() => {
      localStorage.setItem('language', this.language());
    });
  }

  setTheme(theme: Theme) {
    this.theme.set(theme);
  }

  setLanguage(lang: Language) {
    this.language.set(lang);
  }
}
