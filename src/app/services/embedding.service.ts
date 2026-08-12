import { inject, Injectable } from '@angular/core';
import { AiStore } from './ai.store';
import { OrganizationInput } from './organization.types';
import { CachedEmbedding, OrganizationStorageService } from './organization-storage.service';

export const EMBEDDING_BATCH_SIZE = 16;

@Injectable({ providedIn: 'root' })
export class EmbeddingService {
  private store = inject(AiStore);
  private storage = inject(OrganizationStorageService);

  public configurationFingerprint(): string {
    const config = this.store.aiConfig();
    return stableFingerprint(`${config.baseUrl}\n${config.embeddingModel}`);
  }

  public async embed(inputs: readonly OrganizationInput[], signal?: AbortSignal): Promise<Map<string, number[]>> {
    const output = new Map<string, number[]>();
    const configurationFingerprint = this.configurationFingerprint();
    for (let cursor = 0; cursor < inputs.length; cursor += EMBEDDING_BATCH_SIZE) {
      const batch = inputs.slice(cursor, cursor + EMBEDDING_BATCH_SIZE);
      const missing: OrganizationInput[] = [];
      for (const input of batch) {
        const cached = await this.storage.getEmbedding(input.id);
        if (cached?.inputFingerprint === input.fingerprint
          && cached.configurationFingerprint === configurationFingerprint) output.set(input.id, cached.vector);
        else missing.push(input);
      }
      if (missing.length === 0) continue;
      const vectors = await this.requestEmbeddings(missing.map(formatEmbeddingInput), signal);
      const records: CachedEmbedding[] = missing.map((input, index) => ({
        bookmarkId: input.id,
        inputFingerprint: input.fingerprint,
        configurationFingerprint,
        vector: vectors[index]
      }));
      await this.storage.putEmbeddings(records);
      records.forEach(record => output.set(record.bookmarkId, record.vector));
    }
    return output;
  }

  public async testConnection(): Promise<void> {
    await this.requestEmbeddings(['bookmark embedding connection test']);
  }

  private async requestEmbeddings(input: string[], signal?: AbortSignal): Promise<number[][]> {
    const config = this.store.aiConfig();
    if (!config.embeddingModel) throw new Error('Embedding model is required');
    const response = await fetch(`${config.baseUrl}/embeddings`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.embeddingModel, input })
    });
    if (!response.ok) throw new Error(`Embedding API error: ${response.status}`);
    const body = await response.json() as { data?: Array<{ index: number; embedding: unknown }> };
    if (!Array.isArray(body.data) || body.data.length !== input.length) throw new Error('Embedding count mismatch');
    const ordered = [...body.data].sort((a, b) => a.index - b.index).map(item => item.embedding);
    const dimensions = Array.isArray(ordered[0]) ? ordered[0].length : 0;
    if (!dimensions || ordered.some(vector => !Array.isArray(vector)
      || vector.length !== dimensions || vector.some(value => typeof value !== 'number' || !Number.isFinite(value)))) {
      throw new Error('Embedding vectors are invalid');
    }
    return ordered as number[][];
  }
}

export function formatEmbeddingInput(input: OrganizationInput): string {
  return [input.title, input.url, input.path, input.tags.join(', '), input.usefulness ? `usefulness:${input.usefulness}` : ''].join('\n');
}

export function stableFingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
