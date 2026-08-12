import { Injectable, OnDestroy } from '@angular/core';
import { executeSearch } from './search-engine';
import {
  SearchDocument,
  SearchQueryAst,
  SearchRequest,
  SearchWorkerResult
} from './search.types';

interface PendingRequest {
  resolve: (value: string[] | void) => void;
  reject: (reason: Error) => void;
}
@Injectable({ providedIn: 'root' })
export class SearchIndexService implements OnDestroy {
  private readonly worker = this.createWorker();
  private readonly pending = new Map<number, PendingRequest>();
  private documents: SearchDocument[] = [];
  private nextRequestId = 0;
  private latestQueryRequestId = 0;

  constructor() {
    this.worker?.addEventListener('message', this.handleWorkerMessage);
    this.worker?.addEventListener('error', this.handleWorkerError);
  }

  public async rebuild(documents: SearchDocument[]): Promise<void> {
    this.documents = documents;
    if (!this.worker) {
      return;
    }
    const requestId = ++this.nextRequestId;
    await this.send({ type: 'index', requestId, documents });
  }

  public async query(
    query: SearchQueryAst,
    scopeFolderId?: string,
    now = Date.now()
  ): Promise<string[]> {
    const requestId = ++this.nextRequestId;
    this.latestQueryRequestId = requestId;
    if (!this.worker) {
      return executeSearch(this.documents, query, scopeFolderId, now);
    }
    const result = await this.send({ type: 'query', requestId, query, scopeFolderId, now });
    return requestId === this.latestQueryRequestId ? result as string[] : [];
  }

  public ngOnDestroy(): void {
    this.worker?.terminate();
    this.rejectAll(new Error('Search index was destroyed'));
  }

  private send(request: SearchRequest): Promise<string[] | void> {
    return new Promise((resolve, reject) => {
      this.pending.set(request.requestId, { resolve, reject });
      this.worker!.postMessage(request);
    });
  }

  private readonly handleWorkerMessage = ({ data }: MessageEvent<SearchWorkerResult>): void => {
    const pending = this.pending.get(data.requestId);
    if (!pending) {
      return;
    }
    this.pending.delete(data.requestId);
    if (data.type === 'error') {
      pending.reject(new Error(data.message));
    } else if (data.type === 'result') {
      pending.resolve(data.nodeIds);
    } else {
      pending.resolve();
    }
  };

  private readonly handleWorkerError = (): void => {
    this.rejectAll(new Error('Search worker failed'));
  };

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }

  private createWorker(): Worker | undefined {
    if (typeof Worker === 'undefined') {
      return undefined;
    }
    return new Worker(new URL('../workers/search.worker.ts', import.meta.url), { type: 'module' });
  }
}
