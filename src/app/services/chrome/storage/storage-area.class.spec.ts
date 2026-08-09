import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageArea } from './storage-area.class';

describe('StorageArea', () => {
  const storageApi = {
    getBytesInUse: vi.fn(),
    clear: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    get: vi.fn()
  };
  // This test double intentionally implements only the native methods used by StorageArea.
  const nativeStorage = storageApi as unknown as chrome.storage.StorageArea;
  let storage: StorageArea;

  beforeEach(() => {
    vi.resetAllMocks();
    storage = new StorageArea(nativeStorage);
  });

  const items = { theme: 'dark' };
  const rejectionCases = [
    { name: 'getBytesInUse', method: storageApi.getBytesInUse, invoke: () => storage.getBytesInUse('theme'), args: ['theme'] },
    { name: 'clear', method: storageApi.clear, invoke: () => storage.clear(), args: [] },
    { name: 'set', method: storageApi.set, invoke: () => storage.set(items), args: [items] },
    { name: 'remove', method: storageApi.remove, invoke: () => storage.remove('theme'), args: ['theme'] },
    { name: 'get', method: storageApi.get, invoke: () => storage.get('theme'), args: ['theme'] }
  ];

  it.each(rejectionCases)('propagates native $name rejections', async ({ method, invoke, args }) => {
    const failure = new Error('Chrome storage failed');
    method.mockRejectedValueOnce(failure);

    const result = invoke();

    expect(method).toHaveBeenCalledWith(...args);
    await expect(result).rejects.toBe(failure);
  });
});
