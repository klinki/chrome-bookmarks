import { analyzeCleanup } from '../services/cleanup-analysis';
import {
  CleanupAnalysisRequest,
  CleanupAnalysisResponse
} from '../services/cleanup.types';

interface CleanupWorkerScope {
  onmessage: ((event: MessageEvent<CleanupAnalysisRequest>) => void) | null;
  postMessage(message: CleanupAnalysisResponse): void;
}

const workerScope = globalThis as unknown as CleanupWorkerScope;

workerScope.onmessage = ({ data }: MessageEvent<CleanupAnalysisRequest>) => {
  if (data.type !== 'analyze') {
    return;
  }
  let response: CleanupAnalysisResponse;
  try {
    response = {
      type: 'result',
      requestId: data.requestId,
      result: analyzeCleanup(data.input, data.requestId)
    };
  } catch (error) {
    response = {
      type: 'error',
      requestId: data.requestId,
      message: error instanceof Error ? error.message : String(error)
    };
  }
  workerScope.postMessage(response);
};
