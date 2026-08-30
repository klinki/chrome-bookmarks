import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';
import { expect, vi } from 'vitest';

describe('SettingsService', () => {
  let service!: SettingsService;
  let systemPrefersDark = false;
  let systemThemeListeners = new Set<(event: MediaQueryListEvent) => void>();
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
    document.documentElement.style.colorScheme = '';
    systemPrefersDark = false;
    systemThemeListeners = new Set();
    window.matchMedia = vi.fn((query: string) => ({
      matches: systemPrefersDark,
      media: query,
      onchange: null,
      addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
        systemThemeListeners.add(listener);
      },
      removeEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
        systemThemeListeners.delete(listener);
      },
      addListener: (listener: (event: MediaQueryListEvent) => void) => {
        systemThemeListeners.add(listener);
      },
      removeListener: (listener: (event: MediaQueryListEvent) => void) => {
        systemThemeListeners.delete(listener);
      },
      dispatchEvent: vi.fn()
    })) as typeof window.matchMedia;

    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    document.body.className = '';
    document.documentElement.style.colorScheme = '';
  });

  function createService(): SettingsService {
    service = TestBed.inject(SettingsService);
    TestBed.flushEffects();
    return service;
  }

  function setSystemTheme(prefersDark: boolean): void {
    systemPrefersDark = prefersDark;
    const event = {
      matches: prefersDark,
      media: '(prefers-color-scheme: dark)'
    } as MediaQueryListEvent;
    systemThemeListeners.forEach(listener => listener(event));
    TestBed.flushEffects();
  }

  it('should be created', () => {
    expect(createService()).toBeTruthy();
  });

  it('should default to the light theme', () => {
    createService();
    expect(service.theme()).toBe('light');
    expect(service.resolvedTheme()).toBe('light');
    expect(document.body.classList.contains('light-theme')).toBe(true);
  });

  it('should change theme', () => {
    createService();
    service.setTheme('dark');
    expect(service.theme()).toBe('dark');
  });

  it('should migrate the legacy default theme to light', () => {
    localStorage.setItem('theme', 'default');
    createService();

    expect(service.theme()).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('should follow system preference when the theme is auto', () => {
    systemPrefersDark = true;
    createService();
    service.setTheme('auto');
    TestBed.flushEffects();

    expect(service.theme()).toBe('auto');
    expect(service.resolvedTheme()).toBe('dark');
    expect(document.body.classList.contains('dark-theme')).toBe(true);

    setSystemTheme(false);

    expect(service.resolvedTheme()).toBe('light');
    expect(document.body.classList.contains('light-theme')).toBe(true);
  });

  it('should have default language', () => {
    createService();
    expect(service.language()).toBe('en');
  });

  it('should update body class when theme changes', () => {
    createService();
    service.setTheme('dark');
    TestBed.flushEffects();
    expect(document.body.classList.contains('dark-theme')).toBe(true);

    service.setTheme('light');
    TestBed.flushEffects();
    expect(document.body.classList.contains('dark-theme')).toBe(false);
    expect(document.body.classList.contains('light-theme')).toBe(true);
  });
});
