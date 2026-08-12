/// <reference lib="webworker" />

import { executeSearch } from '../services/search-engine';
import { SearchDocument, SearchRequest, SearchWorkerResult } from '../services/search.types';

let documents: SearchDocument[] = [];

addEventListener('message', ({ data }: MessageEvent<SearchRequest>) => {
  try {
    if (data.type === 'index') {
      documents = data.documents;
      postMessage({
        type: 'indexed',
        requestId: data.requestId
      } satisfies SearchWorkerResult);
      return;
    }
    postMessage({
      type: 'result',
      requestId: data.requestId,
      nodeIds: executeSearch(documents, data.query, data.scopeFolderId, data.now)
    } satisfies SearchWorkerResult);
  } catch (error) {
    postMessage({
      type: 'error',
      requestId: data.requestId,
      message: error instanceof Error ? error.message : 'Search worker failed'
    } satisfies SearchWorkerResult);
  }
});
