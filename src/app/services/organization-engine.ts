export interface VectorItem { id: string; vector: number[] }
export interface VectorCluster { id: string; itemIds: string[]; representativeIds: string[]; centroid: number[] }

export function defaultTopicCount(count: number): number {
  return Math.min(count, 80, Math.max(1, Math.round(Math.sqrt(count) / 2)));
}

export function clusterVectors(items: readonly VectorItem[], requestedCount: number): VectorCluster[] {
  if (items.length === 0) return [];
  const dimensions = items[0].vector.length;
  if (!dimensions || items.some(item => item.vector.length !== dimensions)) throw new Error('Vector dimensions differ');
  const normalized = items.map(item => ({ ...item, vector: normalize(item.vector) }));
  const count = Math.max(1, Math.min(requestedCount, items.length));
  const centroids: number[][] = [normalized[0].vector];
  while (centroids.length < count) {
    const candidate = normalized
      .map(item => ({ item, distance: Math.min(...centroids.map(c => 1 - cosine(item.vector, c))) }))
      .sort((a, b) => b.distance - a.distance || a.item.id.localeCompare(b.item.id))[0].item.vector;
    centroids.push(candidate);
  }
  let assignments = new Array<number>(items.length).fill(-1);
  for (let iteration = 0; iteration < 30; iteration++) {
    const next = normalized.map(item => bestCentroid(item.vector, centroids));
    if (next.every((value, index) => value === assignments[index])) break;
    assignments = next;
    for (let cluster = 0; cluster < count; cluster++) {
      const members = normalized.filter((_item, index) => assignments[index] === cluster);
      if (members.length > 0) centroids[cluster] = normalize(average(members.map(item => item.vector)));
    }
  }
  return centroids.map((centroid, index) => {
    const members = normalized.filter((_item, itemIndex) => assignments[itemIndex] === index);
    return {
      id: `cluster-${index + 1}`,
      itemIds: members.map(item => item.id),
      representativeIds: members.toSorted((a, b) =>
        cosine(b.vector, centroid) - cosine(a.vector, centroid) || a.id.localeCompare(b.id)).slice(0, 5).map(item => item.id),
      centroid
    };
  }).filter(cluster => cluster.itemIds.length > 0);
}

function normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude ? vector.map(value => value / magnitude) : [...vector];
}
function cosine(a: number[], b: number[]): number { return a.reduce((sum, value, index) => sum + value * b[index], 0); }
function bestCentroid(vector: number[], centroids: number[][]): number {
  return centroids.map((centroid, index) => ({ index, score: cosine(vector, centroid) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0].index;
}
function average(vectors: number[][]): number[] {
  return vectors[0].map((_value, dimension) =>
    vectors.reduce((sum, vector) => sum + vector[dimension], 0) / vectors.length);
}

export function tagConsolidationCandidates(tags: readonly string[]): Array<{ canonical: string; synonyms: string[] }> {
  const groups = new Map<string, string[]>();
  tags.forEach(tag => {
    const key = tag.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/gu, '');
    groups.set(key, [...(groups.get(key) ?? []), tag]);
  });
  return [...groups.values()].filter(group => new Set(group).size > 1).map(group => ({
    canonical: [...group].sort((a, b) => a.length - b.length || a.localeCompare(b))[0],
    synonyms: [...new Set(group)]
  }));
}
