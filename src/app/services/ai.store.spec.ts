import { TestBed } from '@angular/core/testing';
import { afterEach, vi } from 'vitest';
import {
  AiJobCheckpoint,
  AiStore,
  normalizeAiJobCheckpoint,
  STORAGE_KEY_AI_CHECKPOINT
} from './ai.store';

describe('AiStore', () => {
  const checkpoint: AiJobCheckpoint = {
    version: 1,
    operation: 'usefulness-unscored',
    candidateIds: ['one', 'two'],
    nextCursor: 1,
    total: 2,
    createdAt: 10,
    updatedAt: 20,
    promptVersion: 1,
    configurationFingerprint: 'abc123',
    status: 'running'
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('normalizes valid checkpoints and rejects malformed progress', () => {
    expect(normalizeAiJobCheckpoint(checkpoint)).toEqual(checkpoint);
    expect(normalizeAiJobCheckpoint({ ...checkpoint, candidateIds: ['one', 'one'] })).toBeNull();
    expect(normalizeAiJobCheckpoint({ ...checkpoint, nextCursor: 3 })).toBeNull();
    expect(normalizeAiJobCheckpoint({ ...checkpoint, total: 99 })).toBeNull();
    expect(normalizeAiJobCheckpoint({ ...checkpoint, operation: 'unknown' })).toBeNull();
  });

  it('restores an interrupted checkpoint after a page reload', () => {
    const set = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn((_keys, callback) => callback({
            [STORAGE_KEY_AI_CHECKPOINT]: checkpoint
          })),
          set,
          remove: vi.fn()
        }
      }
    });

    const store = TestBed.inject(AiStore);

    expect(store.checkpoint()).toEqual({
      ...checkpoint,
      status: 'interrupted',
      updatedAt: expect.any(Number)
    });
    expect(store.progress()).toEqual(expect.objectContaining({
      total: 2,
      processed: 1,
      isProcessing: false,
      operation: 'usefulness-unscored'
    }));
    expect(set).toHaveBeenCalledWith({
      [STORAGE_KEY_AI_CHECKPOINT]: expect.objectContaining({ status: 'interrupted' })
    });
  });

  it('persists updates and removes a discarded checkpoint', () => {
    const set = vi.fn();
    const remove = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn((_keys, callback) => callback({})),
          set,
          remove
        }
      }
    });
    const store = TestBed.inject(AiStore);

    store.setCheckpoint({ ...checkpoint, status: 'interrupted' });
    store.updateCheckpoint({ nextCursor: 2, status: 'failed', lastError: 'failed batch' });

    expect(store.checkpoint()).toEqual(expect.objectContaining({
      nextCursor: 2,
      status: 'failed',
      lastError: 'failed batch'
    }));
    expect(set).toHaveBeenCalledTimes(2);

    store.discardCheckpoint();

    expect(remove).toHaveBeenCalledWith(STORAGE_KEY_AI_CHECKPOINT);
    expect(store.checkpoint()).toBeNull();
  });
});
