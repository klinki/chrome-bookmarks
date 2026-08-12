import { inject, Injectable } from '@angular/core';
import { AiStore } from './ai.store';
import { stableFingerprint } from './embedding.service';
import { clusterVectors, defaultTopicCount, tagConsolidationCandidates, VectorCluster } from './organization-engine';
import { OrganizationStorageService } from './organization-storage.service';
import { OrganizationInput, OrganizationPlan, OrganizationScope } from './organization.types';

interface ClusterLabel { id: string; folderPath: string[]; topicTags: string[]; confidence: number; rationale: string }

@Injectable({ providedIn: 'root' })
export class OrganizationPlannerService {
  private store = inject(AiStore);
  private storage = inject(OrganizationStorageService);

  public async generate(
    inputs: readonly OrganizationInput[],
    vectors: ReadonlyMap<string, number[]>,
    destinationRootId: string,
    scope: OrganizationScope = { type: 'all' },
    topicCount = defaultTopicCount(inputs.length),
    signal?: AbortSignal
  ): Promise<OrganizationPlan> {
    const vectorItems = inputs.map(input => ({ id: input.id, vector: vectors.get(input.id)! }));
    if (vectorItems.some(item => !item.vector)) throw new Error('Every bookmark requires an embedding');
    const clusters = await this.cluster(vectorItems, topicCount);
    const labels = await this.label(clusters, inputs, signal);
    const labelMap = new Map(labels.map(label => [label.id, label]));
    const now = Date.now();
    const config = this.store.aiConfig();
    const plan: OrganizationPlan = {
      version: 1, id: crypto.randomUUID(), scope, destinationRootId, topicCount,
      inputFingerprint: stableFingerprint(inputs.map(input => input.fingerprint).join('|')),
      embeddingFingerprint: stableFingerprint(`${config.baseUrl}|${config.embeddingModel}`),
      labelingFingerprint: stableFingerprint(`${config.model}|organization-labels-v1`), createdAt: now,
      clusters: clusters.map(cluster => ({
        id: cluster.id, bookmarkIds: cluster.itemIds, representativeIds: cluster.representativeIds,
        folderPath: labelMap.get(cluster.id)!.folderPath,
        topicTags: labelMap.get(cluster.id)!.topicTags,
        confidence: labelMap.get(cluster.id)!.confidence, rationale: labelMap.get(cluster.id)!.rationale
      })),
      proposals: clusters.flatMap(cluster => cluster.itemIds.map(bookmarkId => ({
        bookmarkId, clusterId: cluster.id, destinationPath: labelMap.get(cluster.id)!.folderPath,
        addTags: labelMap.get(cluster.id)!.topicTags, selected: false, excluded: false
      }))),
      tagConsolidations: tagConsolidationCandidates(inputs.flatMap(input => input.tags))
        .map(candidate => ({ ...candidate, selected: false })), excludedCount: 0
    };
    await this.storage.putPlan(plan);
    return plan;
  }

  private async cluster(items: Array<{ id: string; vector: number[] }>, topicCount: number): Promise<VectorCluster[]> {
    if (typeof Worker === 'undefined') return clusterVectors(items, topicCount);
    const worker = new Worker(new URL('../workers/organization.worker.ts', import.meta.url), { type: 'module' });
    return new Promise((resolve, reject) => {
      worker.onmessage = event => { worker.terminate(); resolve(event.data.clusters); };
      worker.onerror = () => { worker.terminate(); reject(new Error('Organization worker failed')); };
      worker.postMessage({ requestId: 1, items, topicCount });
    });
  }

  private async label(clusters: VectorCluster[], inputs: readonly OrganizationInput[], signal?: AbortSignal): Promise<ClusterLabel[]> {
    const config = this.store.aiConfig();
    const byId = new Map(inputs.map(input => [input.id, input]));
    const payload = clusters.map(cluster => ({ id: cluster.id, representatives: cluster.representativeIds.map(id => byId.get(id)) }));
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, temperature: 0.1,
        messages: [{ role: 'system', content: 'Label bookmark clusters. Return JSON only.' }, { role: 'user', content: JSON.stringify(payload) }],
        response_format: { type: 'json_schema', json_schema: { name: 'organization_labels', strict: true, schema: labelSchema } } })
    });
    if (!response.ok) throw new Error(`Cluster labeling failed: ${response.status}`);
    const body = await response.json();
    const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? '{}');
    if (!Array.isArray(parsed.results) || parsed.results.length !== clusters.length) throw new Error('Incomplete cluster labels');
    const requested = new Set(clusters.map(cluster => cluster.id));
    const seen = new Set<string>();
    for (const label of parsed.results as ClusterLabel[]) {
      if (!requested.has(label.id) || seen.has(label.id) || !Array.isArray(label.folderPath)
        || label.folderPath.length < 1 || label.folderPath.length > 2 || !Array.isArray(label.topicTags)
        || label.topicTags.length > 3 || typeof label.confidence !== 'number' || !Number.isFinite(label.confidence)
        || typeof label.rationale !== 'string') throw new Error('Invalid cluster label');
      seen.add(label.id);
    }
    return parsed.results;
  }
}

const labelSchema = { type: 'object', additionalProperties: false, required: ['results'], properties: {
  results: { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['id', 'folderPath', 'topicTags', 'confidence', 'rationale'], properties: {
      id: { type: 'string' }, folderPath: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string' } },
      topicTags: { type: 'array', maxItems: 3, items: { type: 'string' } }, confidence: { type: 'number' }, rationale: { type: 'string' }
    } }
  }
} };
