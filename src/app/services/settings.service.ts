import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'auto';
type ResolvedTheme = Exclude<Theme, 'auto'>;
export type Language = 'en';

const THEME_STORAGE_KEY = 'theme';
const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';

function normalizeTheme(value: string | null): Theme {
  if (value === 'default') {
    return 'light';
  }

  if (value === 'light' || value === 'dark' || value === 'auto') {
    return value;
  }

  return 'light';
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  readonly theme = signal<Theme>('light');
  readonly language = signal<Language>('en');
  readonly resolvedTheme = computed<ResolvedTheme>(() => {
    const selectedTheme = this.theme();
    if (selectedTheme !== 'auto') {
      return selectedTheme;
    }

    return this.systemPrefersDark() ? 'dark' : 'light';
  });

  private readonly destroyRef = inject(DestroyRef);
  private readonly mediaQueryList = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(SYSTEM_THEME_QUERY)
    : null;
  private readonly systemPrefersDark = signal(this.mediaQueryList?.matches ?? false);

  constructor() {
    // Load from local storage
    this.theme.set(normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY)));

    const savedLang = localStorage.getItem('language') as Language;
    if (savedLang && (savedLang === 'en')) {
      this.language.set(savedLang);
    }

    this.listenForSystemThemeChanges();

    // Persist changes and apply the resolved theme to the document.
    effect(() => {
      const selectedTheme = this.theme();
      const resolvedTheme = this.resolvedTheme();

      localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
      document.body.classList.remove('default-theme', 'light-theme', 'dark-theme');
      document.body.classList.add(`${resolvedTheme}-theme`);
      document.documentElement.style.colorScheme = resolvedTheme;
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

  private listenForSystemThemeChanges(): void {
    const mediaQueryList = this.mediaQueryList;
    if (!mediaQueryList) {
      return;
    }

    const listener = (event: MediaQueryListEvent) => this.systemPrefersDark.set(event.matches);
    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', listener);
      this.destroyRef.onDestroy(() => mediaQueryList.removeEventListener('change', listener));
      return;
    }

    mediaQueryList.addListener(listener);
    this.destroyRef.onDestroy(() => mediaQueryList.removeListener(listener));
  }
}
