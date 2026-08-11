import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOKMARK_METADATA_BUCKET_COUNT,
  BOOKMARK_METADATA_STORAGE_VERSION,
  BucketedBookmarkMetadataStore,
  bookmarkMetadataBucket
} from './bucketed-bookmark-metadata.store';

describe('BucketedBookmarkMetadataStore', () => {
  let originalStorage: typeof chrome.storage;
  let storage: Record<string, unknown>;
  let get: ReturnType<typeof vi.fn>;
  let set: ReturnType<typeof vi.fn>;
  let remove: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalStorage = chrome.storage;
    storage = {};
    get = vi.fn((keys: string[], callback: (value: Record<string, unknown>) => void) => {
      callback(Object.fromEntries(keys
        .filter(key => key in storage)
        .map(key => [key, storage[key]])));
    });
    set = vi.fn((values: Record<string, unknown>, callback?: () => void) => {
      Object.assign(storage, values);
      callback?.();
    });
    remove = vi.fn((key: string, callback?: () => void) => {
      delete storage[key];
      callback?.();
    });
    (chrome as any).storage = { local: { get, set, remove } };
  });

  afterEach(() => {
    (chrome as any).storage = originalStorage;
    vi.restoreAllMocks();
  });

  function createStore(): BucketedBookmarkMetadataStore<string> {
    return new BucketedBookmarkMetadataStore({
      legacyKey: 'legacyMetadata',
      namespace: 'metadata:v2',
      normalizeEntry: value => typeof value === 'string' && value.trim()
        ? value.trim()
        : undefined
    });
  }

  it('hashes bookmark IDs deterministically across 128 buckets', () => {
    const buckets = Array.from({ length: 10_000 }, (_, index) =>
      bookmarkMetadataBucket(`bookmark-${index}`));

    expect(buckets.every(bucket => bucket >= 0 && bucket < BOOKMARK_METADATA_BUCKET_COUNT))
      .toBe(true);
    expect(new Set(buckets).size).toBe(BOOKMARK_METADATA_BUCKET_COUNT);
    expect(bookmarkMetadataBucket('stable')).toBe(bookmarkMetadataBucket('stable'));
  });

  it('migrates a normalized legacy map before publishing the manifest', async () => {
    storage['legacyMetadata'] = { first: ' One ', invalid: 42, second: 'Two' };
    const store = createStore();

    await store.whenReady();

    expect(store.values()).toEqual({ first: 'One', second: 'Two' });
    expect(store.ready()).toBe(true);
    expect(set).toHaveBeenCalledTimes(2);
    const lastSet = set.mock.calls[1][0] as Record<string, unknown>;
    expect(lastSet['metadata:v2:manifest']).toEqual({
      version: BOOKMARK_METADATA_STORAGE_VERSION,
      populatedBuckets: expect.any(Array)
    });
    expect(remove).toHaveBeenCalledWith('legacyMetadata', expect.any(Function));
  });

  it('treats bucket data as authoritative after a valid manifest exists', async () => {
    const bucket = bookmarkMetadataBucket('bucketed');
    storage['legacyMetadata'] = { legacy: 'Legacy' };
    storage['metadata:v2:manifest'] = {
      version: BOOKMARK_METADATA_STORAGE_VERSION,
      populatedBuckets: [bucket]
    };
    storage[`metadata:v2:bucket:${bucket}`] = { bucketed: 'Stored' };

    const store = createStore();
    await store.whenReady();

    expect(store.values()).toEqual({ bucketed: 'Stored' });
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('rebuilds interrupted pre-manifest buckets from the legacy map', async () => {
    storage['legacyMetadata'] = { authoritative: 'Legacy' };
    storage['metadata:v2:bucket:1'] = { stale: 'Stale' };

    const store = createStore();
    await store.whenReady();

    expect(store.values()).toEqual({ authoritative: 'Legacy' });
    expect((storage['metadata:v2:manifest'] as any).populatedBuckets)
      .toEqual([bookmarkMetadataBucket('authoritative')]);
  });

  it('writes only touched buckets and the manifest in one Chrome set call', async () => {
    const store = createStore();
    await store.whenReady();
    set.mockClear();

    store.setEntries({ first: 'One', second: 'Two' });
    await vi.waitFor(() => expect(set).toHaveBeenCalledTimes(1));

    const write = set.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(write)).toContain('metadata:v2:manifest');
    expect(Object.keys(write).filter(key => key.includes(':bucket:')).sort()).toEqual(
      Array.from(new Set([
        bookmarkMetadataBucket('first'),
        bookmarkMetadataBucket('second')
      ])).map(bucket => `metadata:v2:bucket:${bucket}`).sort()
    );
  });

  it('drops malformed bucket entries while loading', async () => {
    const bucket = bookmarkMetadataBucket('valid');
    storage['metadata:v2:manifest'] = {
      version: BOOKMARK_METADATA_STORAGE_VERSION,
      populatedBuckets: [bucket]
    };
    storage[`metadata:v2:bucket:${bucket}`] = {
      valid: ' Value ',
      invalid: false
    };

    const store = createStore();
    await store.whenReady();

    expect(store.values()).toEqual({ valid: 'Value' });
  });

  it('loads 10,000 records from populated buckets', async () => {
    const bucketValues = new Map<number, Record<string, string>>();
    for (let index = 0; index < 10_000; index += 1) {
      const bookmarkId = `bookmark-${index}`;
      const bucket = bookmarkMetadataBucket(bookmarkId);
      const entries = bucketValues.get(bucket) ?? {};
      entries[bookmarkId] = `Value ${index}`;
      bucketValues.set(bucket, entries);
    }
    storage['metadata:v2:manifest'] = {
      version: BOOKMARK_METADATA_STORAGE_VERSION,
      populatedBuckets: Array.from(bucketValues.keys()).sort((left, right) => left - right)
    };
    for (const [bucket, entries] of bucketValues) {
      storage[`metadata:v2:bucket:${bucket}`] = entries;
    }

    const store = createStore();
    await store.whenReady();

    expect(Object.keys(store.values())).toHaveLength(10_000);
    expect(store.values()['bookmark-9_999']).toBeUndefined();
    expect(store.values()['bookmark-9999']).toBe('Value 9999');
  });
});
