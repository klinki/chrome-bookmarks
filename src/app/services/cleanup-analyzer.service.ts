import { DestroyRef, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { BookmarksProviderService } from './bookmarks-provider.service';
import {
  CleanupAnalysisInput,
  CleanupAnalysisRequest,
  CleanupAnalysisResponse,
  CleanupAnalysisResult,
  CleanupNodeSnapshot,
  CleanupSettings
} from './cleanup.types';
import { TagsService } from './tags.service';
import { UsefulnessService } from './usefulness.service';
import { CleanupSettingsService } from './cleanup-settings.service';
import { analyzeCleanup } from './cleanup-analysis';

export type CleanupWorkerFactory = () => Worker | null;

export const CLEANUP_WORKER_FACTORY = new InjectionToken<CleanupWorkerFactory>(
  'CLEANUP_WORKER_FACTORY',
  {
    providedIn: 'root',
    factory: () => () => typeof Worker === 'undefined'
      ? null
      : new Worker(new URL('../workers/cleanup-analysis.worker.ts', import.meta.url), { type: 'module' })
  }
);

export class StaleCleanupAnalysisError extends Error {
  constructor() {
    super('Cleanup analysis was superseded by a newer request');
    this.name = 'StaleCleanupAnalysisError';
  }
}

interface PendingAnalysis {
  resolve: (result: CleanupAnalysisResult) => void;
  reject: (error: Error) => void;
}

@Injectable({ providedIn: 'root' })
export class CleanupAnalyzerService {
  private readonly provider = inject(BookmarksProviderService);
  private readonly tagsService = inject(TagsService);
  private readonly usefulnessService = inject(UsefulnessService);
  private readonly settingsService = inject(CleanupSettingsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly worker = inject(CLEANUP_WORKER_FACTORY)();
  private readonly pending = new Map<number, PendingAnalysis>();
  private latestRequestId = 0;
  private scheduledTimer: ReturnType<typeof setTimeout> | null = null;

  public readonly result = signal<CleanupAnalysisResult | null>(null);
  public readonly analyzing = signal(false);
  public readonly error = signal<string | null>(null);

  constructor() {
    if (this.worker) {
      this.worker.onmessage = ({ data }: MessageEvent<CleanupAnalysisResponse>) => {
        this.handleWorkerResponse(data);
      };
      this.worker.onerror = event => {
        const message = event.message || 'Cleanup analysis worker failed';
        this.failLatest(new Error(message));
      };
    }
    this.destroyRef.onDestroy(() => {
      if (this.scheduledTimer) {
        clearTimeout(this.scheduledTimer);
      }
      this.worker?.terminate();
      for (const analysis of this.pending.values()) {
        analysis.reject(new StaleCleanupAnalysisError());
      }
      this.pending.clear();
    });
  }

  public async analyzeCurrentLibrary(settings = this.settingsService.settings()): Promise<CleanupAnalysisResult> {
    const tree = await this.provider.getBookmarks();
    return this.analyze(tree, settings);
  }

  public async analyze(
    tree: chrome.bookmarks.BookmarkTreeNode[],
    settings = this.settingsService.settings()
  ): Promise<CleanupAnalysisResult> {
    await Promise.all([
      this.tagsService.whenReady(),
      this.usefulnessService.whenReady()
    ]);
    const requestId = ++this.latestRequestId;
    this.supersedeOlderRequests(requestId);
    const input = this.createInput(tree, settings);
    this.analyzing.set(true);
    this.error.set(null);

    if (!this.worker) {
      await Promise.resolve();
      try {
        const result = analyzeCleanup(input, requestId);
        if (requestId !== this.latestRequestId) {
          throw new StaleCleanupAnalysisError();
        }
        this.result.set(result);
        this.analyzing.set(false);
        return result;
      } catch (error) {
        if (requestId === this.latestRequestId) {
          this.analyzing.set(false);
          if (!(error instanceof StaleCleanupAnalysisError)) {
            this.error.set(error instanceof Error ? error.message : String(error));
          }
        }
        throw error;
      }
    }

    return new Promise<CleanupAnalysisResult>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      const request: CleanupAnalysisRequest = { type: 'analyze', requestId, input };
      this.worker!.postMessage(request);
    });
  }

  public scheduleCurrentLibraryAnalysis(delayMilliseconds = 250): void {
    if (this.scheduledTimer) {
      clearTimeout(this.scheduledTimer);
    }
    this.scheduledTimer = setTimeout(() => {
      this.scheduledTimer = null;
      void this.analyzeCurrentLibrary().catch(error => {
        if (!(error instanceof StaleCleanupAnalysisError)) {
          this.error.set(error instanceof Error ? error.message : String(error));
        }
      });
    }, delayMilliseconds);
  }

  private handleWorkerResponse(response: CleanupAnalysisResponse): void {
    const pending = this.pending.get(response.requestId);
    if (!pending) {
      return;
    }
    this.pending.delete(response.requestId);
    if (response.requestId !== this.latestRequestId) {
      pending.reject(new StaleCleanupAnalysisError());
      return;
    }
    this.analyzing.set(false);
    if (response.type === 'error') {
      this.error.set(response.message);
      pending.reject(new Error(response.message));
      return;
    }
    this.result.set(response.result);
    pending.resolve(response.result);
  }

  private failLatest(error: Error): void {
    const pending = this.pending.get(this.latestRequestId);
    if (pending) {
      this.pending.delete(this.latestRequestId);
      pending.reject(error);
    }
    this.analyzing.set(false);
    this.error.set(error.message);
  }

  private supersedeOlderRequests(currentRequestId: number): void {
    for (const [requestId, analysis] of this.pending) {
      if (requestId < currentRequestId) {
        analysis.reject(new StaleCleanupAnalysisError());
        this.pending.delete(requestId);
      }
    }
  }

  private createInput(
    tree: chrome.bookmarks.BookmarkTreeNode[],
    settings: CleanupSettings
  ): CleanupAnalysisInput {
    return {
      nodes: this.flattenTree(tree),
      tags: this.tagsService.bookmarkTags(),
      usefulness: this.usefulnessService.bookmarkUsefulness(),
      settings,
      now: Date.now()
    };
  }

  private flattenTree(tree: chrome.bookmarks.BookmarkTreeNode[]): CleanupNodeSnapshot[] {
    const output: CleanupNodeSnapshot[] = [];
    const stack = [...tree];
    while (stack.length > 0) {
      const node = stack.pop()!;
      const nodeWithUsage = node as chrome.bookmarks.BookmarkTreeNode & { dateLastUsed?: number };
      output.push({
        id: node.id,
        title: node.title,
        ...(node.url === undefined ? {} : { url: node.url }),
        ...(node.parentId === undefined ? {} : { parentId: node.parentId }),
        ...(node.index === undefined ? {} : { index: node.index }),
        ...(node.dateAdded === undefined ? {} : { dateAdded: node.dateAdded }),
        ...(nodeWithUsage.dateLastUsed === undefined
          ? {}
          : { dateLastUsed: nodeWithUsage.dateLastUsed }),
        isFolder: !node.url,
        childCount: node.children?.length ?? 0,
        ...(node.unmodifiable === undefined ? {} : { unmodifiable: node.unmodifiable })
      });
      if (node.children) {
        stack.push(...node.children);
      }
    }
    return output;
  }
}
