import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import {
  CLEANUP_WORKER_FACTORY,
  CleanupAnalyzerService,
  StaleCleanupAnalysisError
} from './cleanup-analyzer.service';
import { BookmarksProviderService } from './bookmarks-provider.service';
import { TagsService } from './tags.service';
import { UsefulnessService } from './usefulness.service';
import { CleanupSettingsService } from './cleanup-settings.service';
import {
  CleanupAnalysisRequest,
  CleanupAnalysisResponse
} from './cleanup.types';
import { analyzeCleanup } from './cleanup-analysis';

class FakeCleanupWorker {
  public onmessage: ((event: MessageEvent<CleanupAnalysisResponse>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public readonly requests: CleanupAnalysisRequest[] = [];
  public terminate = vi.fn();

  public postMessage(request: CleanupAnalysisRequest): void {
    this.requests.push(request);
  }

  public respond(request: CleanupAnalysisRequest): void {
    this.onmessage?.({
      data: {
        type: 'result',
        requestId: request.requestId,
        result: analyzeCleanup(request.input, request.requestId)
      }
    } as MessageEvent<CleanupAnalysisResponse>);
  }
}

describe('CleanupAnalyzerService', () => {
  let worker: FakeCleanupWorker;
  let service: CleanupAnalyzerService;
  let provider: { getBookmarks: ReturnType<typeof vi.fn> };
  const tree = [{
    id: '0',
    title: 'root',
    children: [{
      id: '1',
      parentId: '0',
      title: 'Bookmarks Bar',
      children: [{
        id: 'bookmark',
        parentId: '1',
        title: 'Bookmark',
        url: 'https://example.com'
      }]
    }]
  }] as chrome.bookmarks.BookmarkTreeNode[];

  beforeEach(() => {
    worker = new FakeCleanupWorker();
    provider = { getBookmarks: vi.fn().mockResolvedValue(tree) };
    TestBed.configureTestingModule({
      providers: [
        CleanupAnalyzerService,
        { provide: CLEANUP_WORKER_FACTORY, useValue: () => worker as unknown as Worker },
        { provide: BookmarksProviderService, useValue: provider },
        {
          provide: TagsService,
          useValue: {
            whenReady: vi.fn().mockResolvedValue(undefined),
            bookmarkTags: signal({ bookmark: ['reference'] })
          }
        },
        {
          provide: UsefulnessService,
          useValue: {
            whenReady: vi.fn().mockResolvedValue(undefined),
            bookmarkUsefulness: signal({ bookmark: { score: 4, source: 'manual' } })
          }
        },
        {
          provide: CleanupSettingsService,
          useValue: { settings: signal({ staleDays: 730 }) }
        }
      ]
    });
    service = TestBed.inject(CleanupAnalyzerService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('suppresses an older worker response after a newer request starts', async () => {
    const first = service.analyze(tree);
    const firstRejection = expect(first).rejects.toBeInstanceOf(StaleCleanupAnalysisError);
    await vi.waitFor(() => expect(worker.requests).toHaveLength(1));
    const second = service.analyze(tree);
    await firstRejection;
    await vi.waitFor(() => expect(worker.requests).toHaveLength(2));

    worker.respond(worker.requests[0]);
    expect(service.result()).toBeNull();
    worker.respond(worker.requests[1]);

    const result = await second;
    expect(result.requestId).toBe(2);
    expect(service.result()?.requestId).toBe(2);
    expect(service.analyzing()).toBe(false);
  });

  it('debounces current-library analysis requests', async () => {
    vi.useFakeTimers();
    service.scheduleCurrentLibraryAnalysis(250);
    service.scheduleCurrentLibraryAnalysis(250);
    await vi.advanceTimersByTimeAsync(250);
    await vi.waitFor(() => expect(worker.requests).toHaveLength(1));

    expect(provider.getBookmarks).toHaveBeenCalledTimes(1);
    worker.respond(worker.requests[0]);
    expect(service.result()?.requestId).toBe(1);
  });
});
