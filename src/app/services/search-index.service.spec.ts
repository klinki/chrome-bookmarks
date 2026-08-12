import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchIndexService } from './search-index.service';
import { parseSearchQuery } from './search-query';
import { SearchRequest, SearchWorkerResult } from './search.types';

class WorkerStub {
  public requests: SearchRequest[] = [];
  private message?: (event: MessageEvent<SearchWorkerResult>) => void;

  public addEventListener(type: string, listener: EventListener): void {
    if (type === 'message') {
      this.message = listener as (event: MessageEvent<SearchWorkerResult>) => void;
    }
  }
  public postMessage(request: SearchRequest): void {
    this.requests.push(request);
  }
  public respond(result: SearchWorkerResult): void {
    this.message?.({ data: result } as MessageEvent<SearchWorkerResult>);
  }
  public terminate(): void {}
}

describe('SearchIndexService', () => {
  const originalWorker = globalThis.Worker;

  afterEach(() => {
    vi.stubGlobal('Worker', originalWorker);
  });

  it('uses monotonic IDs and ignores an older query response', async () => {
    const worker = new WorkerStub();
    const WorkerMock = function () {
      return worker;
    } as unknown as typeof Worker;
    vi.stubGlobal('Worker', WorkerMock);
    const service = new SearchIndexService();
    const rebuild = service.rebuild([]);
    worker.respond({ type: 'indexed', requestId: 1 });
    await rebuild;

    const first = service.query(parseSearchQuery('first'));
    const second = service.query(parseSearchQuery('second'));
    worker.respond({ type: 'result', requestId: 3, nodeIds: ['new'] });
    worker.respond({ type: 'result', requestId: 2, nodeIds: ['old'] });

    await expect(second).resolves.toEqual(['new']);
    await expect(first).resolves.toEqual([]);
    expect(worker.requests.map(request => request.requestId)).toEqual([1, 2, 3]);
  });
});
