import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SmartCollectionsService } from './smart-collections.service';

describe('SmartCollectionsService', () => {
  let service: SmartCollectionsService;

  beforeEach(() => {
    vi.stubGlobal('chrome', undefined);
    localStorage.clear();
    service = new SmartCollectionsService();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('creates, updates, duplicates, sorts, and deletes collections', () => {
    const zeta = service.create({ name: 'Zeta', query: 'tag:zeta' });
    const alpha = service.create({ name: 'alpha', query: 'score:>=4', scopeFolderId: 'folder' });

    expect(service.collections().map(item => item.name)).toEqual(['alpha', 'Zeta']);
    service.update(alpha.id, { sortColumn: 'usefulness', sortDirection: 'desc' });
    expect(service.get(alpha.id)).toEqual(expect.objectContaining({
      sortColumn: 'usefulness', sortDirection: 'desc'
    }));
    const copy = service.duplicate(alpha.id);
    expect(copy.name).toBe('alpha Copy');
    service.delete(zeta.id);
    expect(service.get(zeta.id)).toBeUndefined();
  });

  it('enforces valid queries and case-insensitive unique names', () => {
    service.create({ name: 'Reading', query: 'is:untagged' });

    expect(() => service.create({ name: 'reading', query: 'tag:read' })).toThrow('already exists');
    expect(() => service.create({ name: 'Broken', query: 'title:"open' })).toThrow();
  });

  it('remaps imported scopes and resolves ID and name conflicts', () => {
    const existing = service.create({ name: 'Work', query: 'tag:work' });
    const warnings = service.mergeImported([{
      ...existing,
      scopeFolderId: 'missing'
    }], new Map());

    expect(warnings).toHaveLength(1);
    expect(service.collections()).toHaveLength(2);
    expect(service.collections().some(item => item.name === 'Work (Imported)')).toBe(true);
    expect(new Set(service.collections().map(item => item.id)).size).toBe(2);
  });
});
