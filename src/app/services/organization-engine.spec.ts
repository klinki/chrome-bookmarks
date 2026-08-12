import { describe, expect, it } from 'vitest';
import { clusterVectors, defaultTopicCount, tagConsolidationCandidates } from './organization-engine';

describe('organization engine', () => {
  it('computes bounded deterministic topic defaults', () => {
    expect(defaultTopicCount(10_000)).toBe(50);
    expect(defaultTopicCount(50_000)).toBe(80);
    expect(defaultTopicCount(1)).toBe(1);
  });
  it('clusters every vector deterministically and selects representatives', () => {
    const items = [
      { id: 'a', vector: [1, 0] }, { id: 'b', vector: [.9, .1] },
      { id: 'c', vector: [0, 1] }, { id: 'd', vector: [.1, .9] }
    ];
    const first = clusterVectors(items, 2);
    expect(first).toEqual(clusterVectors(items, 2));
    expect(first.flatMap(cluster => cluster.itemIds).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(first.every(cluster => cluster.representativeIds.length > 0)).toBe(true);
  });
  it('proposes normalized spelling consolidation without selecting it', () => {
    expect(tagConsolidationCandidates(['TypeScript', 'type-script', 'Other'])).toEqual([
      { canonical: 'TypeScript', synonyms: ['TypeScript', 'type-script'] }
    ]);
  });
});
