import type { UsefulnessRating } from './usefulness.service';

export type CleanupReason =
  | 'exact-duplicate'
  | 'probable-duplicate'
  | 'stale'
  | 'unknown-usage'
  | 'untagged'
  | 'unrated'
  | 'low-usefulness'
  | 'empty-folder'
  | 'quarantined';

export type DuplicateKind = 'exact' | 'probable';

export interface CleanupSettings {
  staleDays: number;
}

export interface CleanupNodeSnapshot {
  id: string;
  title: string;
  url?: string;
  parentId?: string;
  index?: number;
  dateAdded?: number;
  dateLastUsed?: number;
  isFolder: boolean;
  childCount: number;
  unmodifiable?: string;
}

export interface CleanupFinding {
  nodeId: string;
  title: string;
  url?: string;
  parentId?: string;
  index?: number;
  matchedReasons: CleanupReason[];
  actionable: boolean;
  undated?: boolean;
}

export interface DuplicateGroup {
  id: string;
  kind: DuplicateKind;
  normalizedUrl: string;
  bookmarkIds: string[];
  keeperId: string;
}

export interface QuarantineRecord {
  nodeId: string;
  actionReason: Exclude<CleanupReason, 'quarantined'>;
  matchedReasons: CleanupReason[];
  originalParentId: string;
  originalIndex: number;
  quarantinedAt: number;
}

export interface CleanupAnalysisInput {
  nodes: CleanupNodeSnapshot[];
  tags: Readonly<Record<string, readonly string[]>>;
  usefulness: Readonly<Record<string, UsefulnessRating>>;
  settings: CleanupSettings;
  now: number;
}

export interface CleanupAnalysisResult {
  requestId: number;
  analyzedAt: number;
  findings: CleanupFinding[];
  exactDuplicateGroups: DuplicateGroup[];
  probableDuplicateGroups: DuplicateGroup[];
  counts: Record<CleanupReason, number>;
  excludedNodeCount: number;
}

export interface CleanupAnalysisRequest {
  type: 'analyze';
  requestId: number;
  input: CleanupAnalysisInput;
}

export interface CleanupAnalysisSuccess {
  type: 'result';
  requestId: number;
  result: CleanupAnalysisResult;
}

export interface CleanupAnalysisFailure {
  type: 'error';
  requestId: number;
  message: string;
}

export type CleanupAnalysisResponse = CleanupAnalysisSuccess | CleanupAnalysisFailure;
