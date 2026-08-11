import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { developmentLogger } from './development-logger';

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  allowNewTags: boolean;
}

export type AiOperation = 'tags' | 'usefulness-unscored' | 'usefulness-rerate';

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
}

const initialState: AiState = {
  aiConfig: {
    baseUrl: 'http://localhost:11434/v1',
    apiKey: '',
    model: 'llama3:8b',
    allowNewTags: false
  },
  progress: {
    total: 0,
    processed: 0,
    isProcessing: false,
    isPaused: false,
    isCancelled: false,
    currentBatch: '',
    operation: null
  }
};

const STORAGE_KEY_AI_CONFIG = 'aiConfig';

export const AiStore = signalStore(
  { providedIn: 'root', protectedState: false },
  withState(initialState),
  withMethods((store) => ({
    updateAiConfig(config: Partial<AiConfig>): void {
      const aiConfig = {
        ...store.aiConfig(),
        ...config
      };

      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ [STORAGE_KEY_AI_CONFIG]: aiConfig });
      } else {
        localStorage.setItem(STORAGE_KEY_AI_CONFIG, JSON.stringify(aiConfig));
      }

      patchState(store, { aiConfig });
    },
    updateProgress(progress: Partial<AiProgress>): void {
      patchState(store, (state) => ({
        progress: {
          ...state.progress,
          ...progress
        }
      }));
    },
    togglePause(): void {
      patchState(store, (state) => ({
        progress: {
          ...state.progress,
          isPaused: !state.progress.isPaused
        }
      }));
    },
    cancelProcessing(): void {
      patchState(store, (state) => ({
        progress: {
          ...state.progress,
          isCancelled: true,
          isProcessing: false
        }
      }));
    },
    resetProgress(): void {
      patchState(store, { progress: initialState.progress });
    }
  })),
  withHooks({
    onInit(store) {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get([STORAGE_KEY_AI_CONFIG], (result) => {
          const aiConfig = result[STORAGE_KEY_AI_CONFIG] as AiConfig | undefined;
          if (aiConfig) {
            patchState(store, { aiConfig: { ...store.aiConfig(), ...aiConfig } });
          }
        });
        return;
      }

      const saved = localStorage.getItem(STORAGE_KEY_AI_CONFIG);
      if (!saved) {
        return;
      }

      try {
        const aiConfig = JSON.parse(saved) as Partial<AiConfig>;
        patchState(store, { aiConfig: { ...store.aiConfig(), ...aiConfig } });
      } catch (error) {
        developmentLogger.error('ai.config.parse.failed', error);
      }
    }
  })
);
