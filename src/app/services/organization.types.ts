export type OrganizationScope =
  | { type: 'all' }
  | { type: 'folder'; folderId: string }
  | { type: 'smart-collection'; collectionId: string }
  | { type: 'selection'; bookmarkIds: string[] };

export interface OrganizationInput {
  id: string;
  title: string;
  url: string;
  path: string;
  tags: string[];
  usefulness?: number;
  fingerprint: string;
}

export interface OrganizationCluster {
  id: string;
  bookmarkIds: string[];
  representativeIds: string[];
  folderPath: string[];
  topicTags: string[];
  confidence: number;
  rationale: string;
}

export interface OrganizationProposal {
  bookmarkId: string;
  clusterId: string;
  destinationPath: string[];
  addTags: string[];
  selected: boolean;
  excluded: boolean;
}

export interface TagConsolidationProposal {
  canonical: string;
  synonyms: string[];
  selected: boolean;
}

export interface OrganizationPlan {
  version: 1;
  id: string;
  scope: OrganizationScope;
  destinationRootId: string;
  topicCount: number;
  inputFingerprint: string;
  embeddingFingerprint: string;
  labelingFingerprint: string;
  createdAt: number;
  clusters: OrganizationCluster[];
  proposals: OrganizationProposal[];
  tagConsolidations: TagConsolidationProposal[];
  excludedCount: number;
}

export interface OrganizationUndoJournal {
  version: 1;
  appliedAt: number;
  moves: Array<{ bookmarkId: string; fromParentId: string; toParentId: string }>;
  tags: Array<{ bookmarkId: string; before: string[]; after: string[] }>;
  createdFolderIds: string[];
}
