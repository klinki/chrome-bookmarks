import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';
import { expect } from 'vitest';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SettingsService);
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have default theme', () => {
    expect(service.theme()).toBe('default');
  });

  it('should change theme', () => {
    service.setTheme('dark');
    expect(service.theme()).toBe('dark');
  });

  it('should have default language', () => {
    expect(service.language()).toBe('en');
  });

  it('should update body class when theme changes', () => {
    TestBed.flushEffects();
    service.setTheme('dark');
    TestBed.flushEffects();
    expect(document.body.classList.contains('dark-theme')).toBe(true);

    service.setTheme('default');
    TestBed.flushEffects();
    expect(document.body.classList.contains('dark-theme')).toBe(false);
  });
});
