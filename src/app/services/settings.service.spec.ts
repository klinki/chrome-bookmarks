import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';

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
});
