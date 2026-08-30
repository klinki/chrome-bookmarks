import { TestBed } from '@angular/core/testing';
import { afterEach, vi } from 'vitest';
import { CleanupSettingsService, normalizeCleanupSettings } from './cleanup-settings.service';

describe('CleanupSettingsService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('normalizes the default and accepted stale thresholds', () => {
    expect(normalizeCleanupSettings(null)).toEqual({
      staleDays: 730,
      cleanupExcludedFolderIds: [],
      organizeExcludedFolderIds: []
    });
    expect(normalizeCleanupSettings({ staleDays: 365 })).toEqual({
      staleDays: 365,
      cleanupExcludedFolderIds: [],
      organizeExcludedFolderIds: []
    });
    expect(normalizeCleanupSettings({ staleDays: 0 })).toEqual({
      staleDays: 730,
      cleanupExcludedFolderIds: [],
      organizeExcludedFolderIds: []
    });
    expect(normalizeCleanupSettings({ staleDays: 12.5 })).toEqual({
      staleDays: 730,
      cleanupExcludedFolderIds: [],
      organizeExcludedFolderIds: []
    });
  });

  it('keeps cleanup and organization exclusions separate', () => {
    expect(normalizeCleanupSettings({
      staleDays: 365,
      cleanupExcludedFolderIds: ['folder-1', 'folder-1', '', 42, 'folder-2'],
      organizeExcludedFolderIds: ['folder-3']
    })).toEqual({
      staleDays: 365,
      cleanupExcludedFolderIds: ['folder-1', 'folder-2'],
      organizeExcludedFolderIds: ['folder-3']
    });
  });

  it('migrates the previous shared exclusion list into both features', () => {
    expect(normalizeCleanupSettings({
      staleDays: 365,
      excludedFolderIds: ['legacy-folder']
    })).toEqual({
      staleDays: 365,
      cleanupExcludedFolderIds: ['legacy-folder'],
      organizeExcludedFolderIds: ['legacy-folder']
    });
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
    expect(service.settings()).toEqual({
      staleDays: 400,
      cleanupExcludedFolderIds: [],
      organizeExcludedFolderIds: []
    });

    service.update({ staleDays: 900 });

    expect(service.settings()).toEqual({
      staleDays: 900,
      cleanupExcludedFolderIds: [],
      organizeExcludedFolderIds: []
    });
    expect(set).toHaveBeenCalledWith({
      cleanupSettings: {
        staleDays: 900,
        cleanupExcludedFolderIds: [],
        organizeExcludedFolderIds: []
      }
    });
  });
});
