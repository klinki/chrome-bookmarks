import { Injectable, signal } from '@angular/core';
import { CleanupSettings } from './cleanup.types';

const STORAGE_KEY = 'cleanupSettings';
const DEFAULT_SETTINGS: CleanupSettings = { staleDays: 730, excludedFolderIds: [] };

@Injectable({ providedIn: 'root' })
export class CleanupSettingsService {
  public readonly settings = signal<CleanupSettings>({ ...DEFAULT_SETTINGS });

  constructor() {
    this.load();
  }

  public update(settings: Partial<CleanupSettings>): void {
    const next = normalizeCleanupSettings({ ...this.settings(), ...settings });
    this.settings.set(next);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      void chrome.storage.local.set({ [STORAGE_KEY]: next });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }

  private load(): void {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([STORAGE_KEY], result => {
        this.settings.set(normalizeCleanupSettings(result[STORAGE_KEY]));
      });
      return;
    }
    try {
      this.settings.set(normalizeCleanupSettings(
        JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
      ));
    } catch {
      this.settings.set({ ...DEFAULT_SETTINGS });
    }
  }
}

export function normalizeCleanupSettings(value: unknown): CleanupSettings {
  const staleDays = isRecord(value)
    && typeof value['staleDays'] === 'number'
    && Number.isInteger(value['staleDays'])
    && value['staleDays'] >= 1
    && value['staleDays'] <= 36_500
    ? value['staleDays']
    : DEFAULT_SETTINGS.staleDays;
  const excludedFolderIds = isRecord(value) && Array.isArray(value['excludedFolderIds'])
    ? [...new Set(value['excludedFolderIds'].filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : [];
  return { staleDays, excludedFolderIds };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
