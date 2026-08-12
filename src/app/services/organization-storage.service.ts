import { Injectable } from '@angular/core';
import { OrganizationPlan, OrganizationUndoJournal } from './organization.types';

export interface CachedEmbedding {
  bookmarkId: string;
  inputFingerprint: string;
  configurationFingerprint: string;
  vector: number[];
  enrichedAt?: number;
  etag?: string;
  lastModified?: string;
}

const DB_NAME = 'bookmarkOrganization';
const DB_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class OrganizationStorageService {
  private memoryEmbeddings = new Map<string, CachedEmbedding>();
  private memoryPlans = new Map<string, OrganizationPlan>();

  public async getEmbedding(bookmarkId: string): Promise<CachedEmbedding | undefined> {
    return this.read<CachedEmbedding>('embeddings', bookmarkId) ?? this.memoryEmbeddings.get(bookmarkId);
  }

  public async putEmbeddings(values: readonly CachedEmbedding[]): Promise<void> {
    values.forEach(value => this.memoryEmbeddings.set(value.bookmarkId, structuredClone(value)));
    await this.writeMany('embeddings', values);
  }

  public async putPlan(plan: OrganizationPlan): Promise<void> {
    this.memoryPlans.set(plan.id, structuredClone(plan));
    await this.writeMany('plans', [plan]);
  }

  public async getPlan(id: string): Promise<OrganizationPlan | undefined> {
    return this.read<OrganizationPlan>('plans', id) ?? this.memoryPlans.get(id);
  }

  public async setUndoJournal(journal: OrganizationUndoJournal | null): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      if (journal) await chrome.storage.local.set({ organizationUndoJournal: journal });
      else await chrome.storage.local.remove('organizationUndoJournal');
    } else if (journal) localStorage.setItem('organizationUndoJournal', JSON.stringify(journal));
    else localStorage.removeItem('organizationUndoJournal');
  }

  public async getUndoJournal(): Promise<OrganizationUndoJournal | null> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get('organizationUndoJournal');
      return (result['organizationUndoJournal'] as OrganizationUndoJournal | undefined) ?? null;
    }
    try { return JSON.parse(localStorage.getItem('organizationUndoJournal') ?? 'null'); }
    catch { return null; }
  }

  private async read<T>(storeName: string, key: string): Promise<T | undefined> {
    if (typeof indexedDB === 'undefined') return undefined;
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  private async writeMany(storeName: string, values: readonly unknown[]): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      values.forEach(value => transaction.objectStore(storeName).put(value));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('embeddings')) db.createObjectStore('embeddings', { keyPath: 'bookmarkId' });
        if (!db.objectStoreNames.contains('plans')) db.createObjectStore('plans', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
