import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { developmentLogger } from './development-logger';

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  allowNewTags: boolean;
}

export type AiOperation = 'tags' | 'usefulness-unscored' | 'usefulness-rerate';
export type AiJobStatus = 'running' | 'paused' | 'failed' | 'interrupted';

export interface AiJobCheckpoint {
  version: 1;
  operation: AiOperation;
  candidateIds: string[];
  nextCursor: number;
  total: number;
  createdAt: number;
  updatedAt: number;
  promptVersion: number;
  configurationFingerprint: string;
  tagPoolSnapshot?: string[];
  status: AiJobStatus;
  lastError?: string;
}

export interface AiProgress {
  total: number;
  processed: number;
  isProcessing: boolean;
  isPaused: boolean;
  isCancelled: boolean;
  currentBatch: string;
  operation: AiOperation | null;
}

interface AiState {
  aiConfig: AiConfig;
  progress: AiProgress;
  checkpoint: AiJobCheckpoint | null;
}

const initialProgress: AiProgress = {
  total: 0,
  processed: 0,
  isProcessing: false,
  isPaused: false,
  isCancelled: false,
  currentBatch: '',
  operation: null
};

const initialState: AiState = {
  aiConfig: {
    baseUrl: 'http://localhost:11434/v1',
    apiKey: '',
    model: 'llama3:8b',
    allowNewTags: false
  },
  progress: initialProgress,
  checkpoint: null
};

export const STORAGE_KEY_AI_CONFIG = 'aiConfig';
export const STORAGE_KEY_AI_CHECKPOINT = 'aiJobCheckpoint';

export function normalizeAiJobCheckpoint(value: unknown): AiJobCheckpoint | null {
  if (!isRecord(value)
    || value['version'] !== 1
    || !isAiOperation(value['operation'])
    || !Array.isArray(value['candidateIds'])
    || !value['candidateIds'].every(id => typeof id === 'string' && id.length > 0)
    || new Set(value['candidateIds']).size !== value['candidateIds'].length
    || !isNonNegativeInteger(value['nextCursor'])
    || !isNonNegativeInteger(value['total'])
    || value['total'] !== value['candidateIds'].length
    || value['nextCursor'] > value['total']
    || !isFiniteNumber(value['createdAt'])
    || !isFiniteNumber(value['updatedAt'])
    || !isNonNegativeInteger(value['promptVersion'])
    || typeof value['configurationFingerprint'] !== 'string'
    || !isAiJobStatus(value['status'])
    || (value['lastError'] !== undefined && typeof value['lastError'] !== 'string')
    || (value['tagPoolSnapshot'] !== undefined
      && (!Array.isArray(value['tagPoolSnapshot'])
        || !value['tagPoolSnapshot'].every(tag => typeof tag === 'string')))) {
    return null;
  }

  return {
    version: 1,
    operation: value['operation'],
    candidateIds: [...value['candidateIds']],
    nextCursor: value['nextCursor'],
    total: value['total'],
    createdAt: value['createdAt'],
    updatedAt: value['updatedAt'],
    promptVersion: value['promptVersion'],
    configurationFingerprint: value['configurationFingerprint'],
    ...(value['tagPoolSnapshot'] === undefined
      ? {}
      : { tagPoolSnapshot: [...value['tagPoolSnapshot']] }),
    status: value['status'],
    ...(value['lastError'] === undefined ? {} : { lastError: value['lastError'] })
  };
}

function persistValue(key: string, value: unknown): void {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    void chrome.storage.local.set({ [key]: value });
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

function removeValue(key: string): void {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    void chrome.storage.local.remove(key);
  } else {
    localStorage.removeItem(key);
  }
}

function checkpointProgress(checkpoint: AiJobCheckpoint): AiProgress {
  return {
    total: checkpoint.total,
    processed: checkpoint.nextCursor,
    isProcessing: false,
    isPaused: checkpoint.status === 'paused',
    isCancelled: false,
    currentBatch: checkpoint.lastError ?? 'AI job can be resumed',
    operation: checkpoint.operation
  };
}

export const AiStore = signalStore(
  { providedIn: 'root', protectedState: false },
  withState(initialState),
  withMethods((store) => ({
    updateAiConfig(config: Partial<AiConfig>): void {
      const aiConfig = { ...store.aiConfig(), ...config };
      persistValue(STORAGE_KEY_AI_CONFIG, aiConfig);
      patchState(store, { aiConfig });
    },
    updateProgress(progress: Partial<AiProgress>): void {
      patchState(store, state => ({
        progress: { ...state.progress, ...progress }
      }));
    },
    setCheckpoint(value: AiJobCheckpoint): void {
      const checkpoint = normalizeAiJobCheckpoint(value);
      if (!checkpoint) {
        throw new Error('Invalid AI job checkpoint');
      }
      persistValue(STORAGE_KEY_AI_CHECKPOINT, checkpoint);
      patchState(store, { checkpoint });
    },
    updateCheckpoint(value: Partial<AiJobCheckpoint>): void {
      const current = store.checkpoint();
      if (!current) {
        throw new Error('No AI job checkpoint exists');
      }
      const checkpoint = normalizeAiJobCheckpoint({
        ...current,
        ...value,
        updatedAt: value.updatedAt ?? Date.now()
      });
      if (!checkpoint) {
        throw new Error('Invalid AI job checkpoint update');
      }
      persistValue(STORAGE_KEY_AI_CHECKPOINT, checkpoint);
      patchState(store, { checkpoint });
    },
    discardCheckpoint(): void {
      removeValue(STORAGE_KEY_AI_CHECKPOINT);
      patchState(store, { checkpoint: null, progress: initialProgress });
    },
    togglePause(): void {
      const isPaused = !store.progress.isPaused();
      const checkpoint = store.checkpoint();
      if (checkpoint) {
        const updated = { ...checkpoint, status: isPaused ? 'paused' : 'running', updatedAt: Date.now() } as AiJobCheckpoint;
        persistValue(STORAGE_KEY_AI_CHECKPOINT, updated);
        patchState(store, { checkpoint: updated });
      }
      patchState(store, state => ({
        progress: { ...state.progress, isPaused }
      }));
    },
    cancelProcessing(): void {
      removeValue(STORAGE_KEY_AI_CHECKPOINT);
      patchState(store, state => ({
        checkpoint: null,
        progress: {
          ...state.progress,
          isCancelled: true,
          isProcessing: false,
          isPaused: false
        }
      }));
    },
    resetProgress(): void {
      patchState(store, { progress: initialProgress });
    }
  })),
  withHooks({
    onInit(store) {
      const applyStoredValues = (configValue: unknown, checkpointValue: unknown) => {
        if (isRecord(configValue)) {
          patchState(store, { aiConfig: { ...store.aiConfig(), ...configValue } });
        }
        const normalized = normalizeAiJobCheckpoint(checkpointValue);
        if (normalized) {
          const checkpoint: AiJobCheckpoint = normalized.status === 'running'
            ? { ...normalized, status: 'interrupted', updatedAt: Date.now() }
            : normalized;
          if (checkpoint !== normalized) {
            persistValue(STORAGE_KEY_AI_CHECKPOINT, checkpoint);
          }
          patchState(store, {
            checkpoint,
            progress: checkpointProgress(checkpoint)
          });
        }
      };

      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(
          [STORAGE_KEY_AI_CONFIG, STORAGE_KEY_AI_CHECKPOINT],
          result => applyStoredValues(
            result[STORAGE_KEY_AI_CONFIG],
            result[STORAGE_KEY_AI_CHECKPOINT]
          )
        );
        return;
      }

      try {
        applyStoredValues(
          parseStoredValue(localStorage.getItem(STORAGE_KEY_AI_CONFIG)),
          parseStoredValue(localStorage.getItem(STORAGE_KEY_AI_CHECKPOINT))
        );
      } catch (error) {
        developmentLogger.error('ai.storage.parse.failed', error);
      }
    }
  })
);

function parseStoredValue(value: string | null): unknown {
  return value ? JSON.parse(value) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAiOperation(value: unknown): value is AiOperation {
  return value === 'tags' || value === 'usefulness-unscored' || value === 'usefulness-rerate';
}

function isAiJobStatus(value: unknown): value is AiJobStatus {
  return value === 'running' || value === 'paused' || value === 'failed' || value === 'interrupted';
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
