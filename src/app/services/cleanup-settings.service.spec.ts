import { TestBed } from '@angular/core/testing';
import { afterEach, vi } from 'vitest';
import { CleanupSettingsService, normalizeCleanupSettings } from './cleanup-settings.service';

describe('CleanupSettingsService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('normalizes the default and accepted stale thresholds', () => {
    expect(normalizeCleanupSettings(null)).toEqual({ staleDays: 730 });
    expect(normalizeCleanupSettings({ staleDays: 365 })).toEqual({ staleDays: 365 });
    expect(normalizeCleanupSettings({ staleDays: 0 })).toEqual({ staleDays: 730 });
    expect(normalizeCleanupSettings({ staleDays: 12.5 })).toEqual({ staleDays: 730 });
  });

  it('loads and persists settings through Chrome storage', () => {
    const set = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn((_keys, callback) => callback({ cleanupSettings: { staleDays: 400 } })),
          set
        }
      }
    });

    const service = TestBed.inject(CleanupSettingsService);
    expect(service.settings()).toEqual({ staleDays: 400 });

    service.update({ staleDays: 900 });

    expect(service.settings()).toEqual({ staleDays: 900 });
    expect(set).toHaveBeenCalledWith({ cleanupSettings: { staleDays: 900 } });
  });
});
