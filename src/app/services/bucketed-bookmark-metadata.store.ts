import { Signal, WritableSignal, signal } from '@angular/core';

export const BOOKMARK_METADATA_BUCKET_COUNT = 128;
export const BOOKMARK_METADATA_STORAGE_VERSION = 2;

export interface MetadataStorageManifest {
  version: typeof BOOKMARK_METADATA_STORAGE_VERSION;
  populatedBuckets: number[];
}

export interface BucketedBookmarkMetadataStoreOptions<T> {
  legacyKey: string;
  namespace: string;
  normalizeEntry: (value: unknown) => T | undefined;
}

export function bookmarkMetadataBucket(bookmarkId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < bookmarkId.length; index += 1) {
    hash ^= bookmarkId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % BOOKMARK_METADATA_BUCKET_COUNT;
}

export class BucketedBookmarkMetadataStore<T> {
  private readonly manifestKey: string;
  private readonly bucketPrefix: string;
  private readonly buckets = new Map<number, Record<string, T>>();
  private readonly valuesSignal: WritableSignal<Record<string, T>> = signal({});
  private readonly readySignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly pendingUpdates: Array<Readonly<Record<string, T | null>>> = [];
  private writeQueue = Promise.resolve();
  private readonly loadPromise: Promise<void>;

  public readonly values: WritableSignal<Record<string, T>> = this.valuesSignal;
  public readonly ready: Signal<boolean> = this.readySignal.asReadonly();
  public readonly loadError: Signal<string | null> = this.errorSignal.asReadonly();

  constructor(private readonly options: BucketedBookmarkMetadataStoreOptions<T>) {
    this.manifestKey = `${options.namespace}:manifest`;
    this.bucketPrefix = `${options.namespace}:bucket:`;
    this.loadPromise = this.load();
  }

  public whenReady(): Promise<void> {
    return this.loadPromise;
  }

  public setEntries(updates: Readonly<Record<string, T | null>>): void {
    const normalizedUpdates = this.normalizeUpdates(updates);
    if (Object.keys(normalizedUpdates).length === 0) {
      return;
    }

    if (!this.readySignal()) {
      this.pendingUpdates.push(normalizedUpdates);
      this.valuesSignal.set(this.applyToFlatValues(this.valuesSignal(), normalizedUpdates));
      return;
    }

    this.applyAndPersist(normalizedUpdates);
  }

  private async load(): Promise<void> {
    this.readySignal.set(false);
    this.errorSignal.set(null);
    try {
      const loaded = this.hasChromeStorage()
        ? await this.loadFromChrome()
        : this.loadFromLocalStorage();
      this.replaceBuckets(loaded);
    } catch (error) {
      this.replaceBuckets({});
      this.errorSignal.set(error instanceof Error ? error.message : String(error));
    }

    this.readySignal.set(true);
    if (this.pendingUpdates.length > 0) {
      const pending = Object.assign({}, ...this.pendingUpdates);
      this.pendingUpdates.length = 0;
      this.applyAndPersist(pending);
    }
  }

  private async loadFromChrome(): Promise<Record<string, T>> {
    const initial = await this.chromeGet([this.options.legacyKey, this.manifestKey]);
    const manifest = this.normalizeManifest(initial[this.manifestKey]);
    if (manifest) {
      const bucketKeys = manifest.populatedBuckets.map(bucket => this.bucketKey(bucket));
      const storedBuckets = bucketKeys.length > 0 ? await this.chromeGet(bucketKeys) : {};
      return this.combineStoredBuckets(manifest.populatedBuckets, storedBuckets);
    }

    const legacy = this.normalizeRecord(initial[this.options.legacyKey]);
    await this.migrateChromeLegacy(legacy);
    return legacy;
  }

  private loadFromLocalStorage(): Record<string, T> {
    const manifest = this.parseManifest(localStorage.getItem(this.manifestKey));
    if (manifest) {
      const storedBuckets: Record<string, unknown> = {};
      for (const bucket of manifest.populatedBuckets) {
        storedBuckets[this.bucketKey(bucket)] = this.parseJson(
          localStorage.getItem(this.bucketKey(bucket))
        );
      }
      return this.combineStoredBuckets(manifest.populatedBuckets, storedBuckets);
    }

    const legacy = this.normalizeRecord(this.parseJson(
      localStorage.getItem(this.options.legacyKey)
    ));
    const bucketMap = this.createBuckets(legacy);
    for (const [bucket, entries] of bucketMap) {
      localStorage.setItem(this.bucketKey(bucket), JSON.stringify(entries));
    }
    localStorage.setItem(this.manifestKey, JSON.stringify(this.createManifest(bucketMap.keys())));
    localStorage.removeItem(this.options.legacyKey);
    return legacy;
  }

  private async migrateChromeLegacy(values: Record<string, T>): Promise<void> {
    const bucketMap = this.createBuckets(values);
    const bucketWrites: Record<string, unknown> = {};
    for (const [bucket, entries] of bucketMap) {
      bucketWrites[this.bucketKey(bucket)] = entries;
    }
    if (Object.keys(bucketWrites).length > 0) {
      await this.chromeSet(bucketWrites);
    }
    await this.chromeSet({
      [this.manifestKey]: this.createManifest(bucketMap.keys())
    });
    await this.chromeRemove(this.options.legacyKey);
  }

  private applyAndPersist(updates: Readonly<Record<string, T | null>>): void {
    const touched = new Set<number>();
    for (const [bookmarkId, value] of Object.entries(updates)) {
      const bucket = bookmarkMetadataBucket(bookmarkId);
      const entries = { ...(this.buckets.get(bucket) ?? {}) };
      if (value === null) {
        delete entries[bookmarkId];
      } else {
        entries[bookmarkId] = value;
      }
      if (Object.keys(entries).length === 0) {
        this.buckets.delete(bucket);
      } else {
        this.buckets.set(bucket, entries);
      }
      touched.add(bucket);
    }

    this.valuesSignal.set(this.applyToFlatValues(this.valuesSignal(), updates));
    const snapshot = new Map<number, Record<string, T>>();
    for (const bucket of touched) {
      snapshot.set(bucket, { ...(this.buckets.get(bucket) ?? {}) });
    }
    const manifest = this.createManifest(this.buckets.keys());
    this.writeQueue = this.writeQueue
      .then(() => this.persistBuckets(snapshot, manifest))
      .catch(error => {
        this.errorSignal.set(error instanceof Error ? error.message : String(error));
      });
  }

  private async persistBuckets(
    buckets: ReadonlyMap<number, Record<string, T>>,
    manifest: MetadataStorageManifest
  ): Promise<void> {
    const values: Record<string, unknown> = {
      [this.manifestKey]: manifest
    };
    for (const [bucket, entries] of buckets) {
      values[this.bucketKey(bucket)] = entries;
    }

    if (this.hasChromeStorage()) {
      await this.chromeSet(values);
      return;
    }

    for (const [key, value] of Object.entries(values)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  private replaceBuckets(values: Record<string, T>): void {
    this.buckets.clear();
    for (const [bucket, entries] of this.createBuckets(values)) {
      this.buckets.set(bucket, entries);
    }
    this.valuesSignal.set(values);
  }

  private createBuckets(values: Record<string, T>): Map<number, Record<string, T>> {
    const result = new Map<number, Record<string, T>>();
    for (const [bookmarkId, value] of Object.entries(values)) {
      const bucket = bookmarkMetadataBucket(bookmarkId);
      const entries = result.get(bucket) ?? {};
      entries[bookmarkId] = value;
      result.set(bucket, entries);
    }
    return result;
  }

  private combineStoredBuckets(
    populatedBuckets: readonly number[],
    storedBuckets: Readonly<Record<string, unknown>>
  ): Record<string, T> {
    const combined: Record<string, T> = {};
    for (const bucket of populatedBuckets) {
      Object.assign(combined, this.normalizeRecord(storedBuckets[this.bucketKey(bucket)]));
    }
    return combined;
  }

  private normalizeUpdates(
    updates: Readonly<Record<string, T | null>>
  ): Record<string, T | null> {
    const normalized: Record<string, T | null> = {};
    for (const [bookmarkId, value] of Object.entries(updates)) {
      if (!bookmarkId) {
        continue;
      }
      if (value === null) {
        normalized[bookmarkId] = null;
        continue;
      }
      const entry = this.options.normalizeEntry(value);
      if (entry !== undefined) {
        normalized[bookmarkId] = entry;
      }
    }
    return normalized;
  }

  private normalizeRecord(value: unknown): Record<string, T> {
    if (!this.isRecord(value)) {
      return {};
    }
    const normalized: Record<string, T> = {};
    for (const [bookmarkId, storedEntry] of Object.entries(value)) {
      const entry = this.options.normalizeEntry(storedEntry);
      if (bookmarkId && entry !== undefined) {
        normalized[bookmarkId] = entry;
      }
    }
    return normalized;
  }

  private applyToFlatValues(
    current: Record<string, T>,
    updates: Readonly<Record<string, T | null>>
  ): Record<string, T> {
    const next = { ...current };
    for (const [bookmarkId, value] of Object.entries(updates)) {
      if (value === null) {
        delete next[bookmarkId];
      } else {
        next[bookmarkId] = value;
      }
    }
    return next;
  }

  private createManifest(buckets: Iterable<number>): MetadataStorageManifest {
    return {
      version: BOOKMARK_METADATA_STORAGE_VERSION,
      populatedBuckets: Array.from(buckets).sort((left, right) => left - right)
    };
  }

  private normalizeManifest(value: unknown): MetadataStorageManifest | null {
    if (!this.isRecord(value)
      || value['version'] !== BOOKMARK_METADATA_STORAGE_VERSION
      || !Array.isArray(value['populatedBuckets'])) {
      return null;
    }
    const populatedBuckets = Array.from(new Set(value['populatedBuckets']))
      .filter((bucket): bucket is number => Number.isInteger(bucket)
        && typeof bucket === 'number'
        && bucket >= 0
        && bucket < BOOKMARK_METADATA_BUCKET_COUNT)
      .sort((left, right) => left - right);
    if (populatedBuckets.length !== value['populatedBuckets'].length) {
      return null;
    }
    return {
      version: BOOKMARK_METADATA_STORAGE_VERSION,
      populatedBuckets
    };
  }

  private parseManifest(value: string | null): MetadataStorageManifest | null {
    return this.normalizeManifest(this.parseJson(value));
  }

  private parseJson(value: string | null): unknown {
    if (!value) {
      return undefined;
    }
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  private bucketKey(bucket: number): string {
    return `${this.bucketPrefix}${bucket}`;
  }

  private hasChromeStorage(): boolean {
    return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
  }

  private chromeGet(keys: string[]): Promise<Record<string, unknown>> {
    return this.callChromeApi<Record<string, unknown>>(callback =>
      (chrome.storage.local.get as any)(keys, callback)
    );
  }

  private chromeSet(values: Record<string, unknown>): Promise<void> {
    return this.callChromeApi<void>(callback =>
      (chrome.storage.local.set as any)(values, callback)
    );
  }

  private chromeRemove(key: string): Promise<void> {
    return this.callChromeApi<void>(callback =>
      (chrome.storage.local.remove as any)(key, callback)
    );
  }

  private callChromeApi<R>(
    invoke: (callback: (result: R) => void) => Promise<R> | void
  ): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      let settled = false;
      const complete = (value: R) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };
      try {
        const result = invoke(complete);
        if (result && typeof (result as Promise<R>).then === 'function') {
          void (result as Promise<R>).then(complete, reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
