import { Injectable, Signal, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';

export interface BulkMutationFailure {
  id: string;
  error: unknown;
}

export interface BulkMutationProgress {
  operation: string | null;
  active: boolean;
  total: number;
  completed: number;
  failures: BulkMutationFailure[];
  cancelled: boolean;
}

export interface BulkMutationResult<T> {
  operation: string;
  total: number;
  completed: number;
  results: Array<T | undefined>;
  failures: BulkMutationFailure[];
  cancelled: boolean;
}

export interface BulkMutationOptions<TItem, TResult> {
  operation: string;
  items: readonly TItem[];
  identify: (item: TItem, index: number) => string;
  execute: (item: TItem, index: number) => Promise<TResult>;
  concurrency?: number;
}

export class BulkMutationError<T = unknown> extends Error {
  constructor(public readonly result: BulkMutationResult<T>) {
    super(result.cancelled
      ? `${result.operation} was cancelled`
      : `${result.operation} failed for ${result.failures.length} item(s)`);
    this.name = 'BulkMutationError';
  }
}

@Injectable({ providedIn: 'root' })
export class BulkMutationCoordinatorService {
  private readonly progressSignal = signal<BulkMutationProgress>({
    operation: null,
    active: false,
    total: 0,
    completed: 0,
    failures: [],
    cancelled: false
  });
  private cancelRequested = false;

  public readonly progress = this.progressSignal.asReadonly();
  public readonly isActive: Signal<boolean> = computed(() => this.progressSignal().active);
  public readonly completed$ = new Subject<BulkMutationResult<unknown>>();

  public cancel(): void {
    if (!this.progressSignal().active) {
      return;
    }
    this.cancelRequested = true;
    this.progressSignal.update(progress => ({ ...progress, cancelled: true }));
  }

  public async run<TItem, TResult>(
    options: BulkMutationOptions<TItem, TResult>
  ): Promise<BulkMutationResult<TResult>> {
    if (this.progressSignal().active) {
      throw new Error(`Bulk operation "${this.progressSignal().operation}" is already running`);
    }

    const total = options.items.length;
    const results = new Array<TResult | undefined>(total);
    const failures: BulkMutationFailure[] = [];
    this.cancelRequested = false;
    this.progressSignal.set({
      operation: options.operation,
      active: true,
      total,
      completed: 0,
      failures: [],
      cancelled: false
    });

    let nextIndex = 0;
    const worker = async () => {
      while (!this.cancelRequested) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= total) {
          return;
        }
        const item = options.items[index];
        try {
          results[index] = await options.execute(item, index);
        } catch (error) {
          failures.push({ id: options.identify(item, index), error });
        } finally {
          this.progressSignal.update(progress => ({
            ...progress,
            completed: progress.completed + 1,
            failures: [...failures]
          }));
        }
      }
    };

    const concurrency = total === 0
      ? 0
      : Math.min(total, Math.max(1, Math.floor(options.concurrency ?? 1)));
    try {
      await Promise.all(Array.from({ length: concurrency }, () => worker()));
    } finally {
      const current = this.progressSignal();
      const result: BulkMutationResult<TResult> = {
        operation: options.operation,
        total,
        completed: current.completed,
        results,
        failures: [...failures],
        cancelled: current.cancelled
      };
      this.progressSignal.set({ ...current, active: false, failures: [...failures] });
      this.completed$.next(result as BulkMutationResult<unknown>);
    }

    const final = this.progressSignal();
    return {
      operation: options.operation,
      total,
      completed: final.completed,
      results,
      failures: [...failures],
      cancelled: final.cancelled
    };
  }
}
