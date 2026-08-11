import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { BulkMutationCoordinatorService } from './bulk-mutation-coordinator.service';

describe('BulkMutationCoordinatorService', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  }

  it('reports progress and emits one completion after partial failures', async () => {
    const service = TestBed.inject(BulkMutationCoordinatorService);
    const completed = vi.fn();
    service.completed$.subscribe(completed);

    const result = await service.run({
      operation: 'test',
      items: ['one', 'two', 'three'],
      identify: item => item,
      concurrency: 2,
      execute: async item => {
        if (item === 'two') {
          throw new Error('failed');
        }
        return item.toUpperCase();
      }
    });

    expect(result.results).toEqual(['ONE', undefined, 'THREE']);
    expect(result.failures.map(failure => failure.id)).toEqual(['two']);
    expect(service.progress()).toMatchObject({
      active: false,
      total: 3,
      completed: 3,
      cancelled: false
    });
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it('stops claiming new work after cancellation', async () => {
    const service = TestBed.inject(BulkMutationCoordinatorService);
    const first = deferred<string>();
    const execute = vi.fn((item: string) => item === 'one'
      ? first.promise
      : Promise.resolve(item));

    const running = service.run({
      operation: 'cancel-test',
      items: ['one', 'two'],
      identify: item => item,
      execute
    });
    service.cancel();
    first.resolve('ONE');

    const result = await running;
    expect(result.cancelled).toBe(true);
    expect(result.completed).toBe(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects overlapping operations', async () => {
    const service = TestBed.inject(BulkMutationCoordinatorService);
    const pending = deferred<void>();
    const running = service.run({
      operation: 'first',
      items: ['one'],
      identify: item => item,
      execute: () => pending.promise
    });

    await expect(service.run({
      operation: 'second',
      items: [],
      identify: item => item,
      execute: async () => undefined
    })).rejects.toThrow('already running');

    pending.resolve();
    await running;
  });
});
