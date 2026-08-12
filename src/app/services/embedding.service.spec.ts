import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmbeddingService } from './embedding.service';
import { AiStore } from './ai.store';
import { OrganizationStorageService } from './organization-storage.service';

describe('EmbeddingService', () => {
  afterEach(() => vi.restoreAllMocks());

  function createService(data: unknown) {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }));
    TestBed.configureTestingModule({ providers: [
      EmbeddingService,
      { provide: AiStore, useValue: { aiConfig: () => ({ baseUrl: 'http://ai/v1', apiKey: 'x', embeddingModel: 'embed' }) } },
      { provide: OrganizationStorageService, useValue: {
        getEmbedding: vi.fn().mockResolvedValue(undefined), putEmbeddings: vi.fn().mockResolvedValue(undefined)
      } }
    ] });
    return TestBed.inject(EmbeddingService);
  }

  it('serializes bookmark metadata and validates finite, consistent vectors', async () => {
    const service = createService({ data: [{ index: 0, embedding: [1, 2, 3] }] });
    const result = await service.embed([{
      id: 'a', title: 'A', url: 'https://a', path: 'Work', tags: ['tag'], usefulness: 4, fingerprint: 'input'
    }]);
    expect(result.get('a')).toEqual([1, 2, 3]);
    expect(fetch).toHaveBeenCalledWith('http://ai/v1/embeddings', expect.objectContaining({ method: 'POST' }));
  });

  it.each([
    [{ data: [] }, 'count'],
    [{ data: [{ index: 0, embedding: [1, Number.NaN] }] }, 'invalid']
  ])('rejects malformed embedding output', async (body, message) => {
    const service = createService(body);
    await expect(service.testConnection()).rejects.toThrow(message);
  });
});
