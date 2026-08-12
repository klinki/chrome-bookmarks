/// <reference lib="webworker" />
import { clusterVectors, VectorItem } from '../services/organization-engine';

interface Request { requestId: number; items: VectorItem[]; topicCount: number }
addEventListener('message', ({ data }: MessageEvent<Request>) => {
  postMessage({ requestId: data.requestId, clusters: clusterVectors(data.items, data.topicCount) });
});
