import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, merge } from 'rxjs';
import { BookmarksProviderService } from './bookmarks-provider.service';
import {
  BulkMutationCoordinatorService,
  BulkMutationError,
  BulkMutationResult
} from './bulk-mutation-coordinator.service';
import { CleanupReason, QuarantineRecord } from './cleanup.types';
import { ImportExportService } from './import-export.service';
import { TagsService } from './tags.service';
import { UsefulnessService } from './usefulness.service';

type ActionableCleanupReason = Exclude<CleanupReason, 'quarantined'>;

export interface QuarantineOptions {
  items: readonly chrome.bookmarks.BookmarkTreeNode[];
  actionReason: ActionableCleanupReason;
  matchedReasonsById?: Readonly<Record<string, readonly CleanupReason[]>>;
  duplicateKeeperId?: string;
  duplicateBookmarkIds?: readonly string[];
}

interface CleanupFolderManifest {
  version: 1;
  trashId?: string;
  cleanupId?: string;
  restoredId?: string;
  reasonFolderIds: Partial<Record<ActionableCleanupReason, string>>;
}

interface QuarantineStorage {
  version: 1;
  records: Record<string, QuarantineRecord>;
  folders: CleanupFolderManifest;
}

interface CleanupFolders {
  otherBookmarksId: string;
  trashId: string;
  cleanupId: string;
  reasonFolderId?: string;
}

const STORAGE_KEY = 'cleanupQuarantine';
const REASON_FOLDER_NAMES: Record<ActionableCleanupReason, string> = {
  'exact-duplicate': 'Exact duplicates',
  'probable-duplicate': 'Probable duplicates',
  stale: 'Stale',
  'unknown-usage': 'Unknown usage',
  untagged: 'Untagged',
  unrated: 'Unrated',
  'low-usefulness': 'Low usefulness',
  'empty-folder': 'Empty folders'
};

const EMPTY_MANIFEST: CleanupFolderManifest = {
  version: 1,
  reasonFolderIds: {}
};

@Injectable({ providedIn: 'root' })
export class QuarantineService {
  private readonly provider = inject(BookmarksProviderService);
  private readonly bulkMutations = inject(BulkMutationCoordinatorService);
  private readonly tagsService = inject(TagsService);
  private readonly usefulnessService = inject(UsefulnessService);
  private readonly importExport = inject(ImportExportService);
  private readonly destroyRef = inject(DestroyRef);
  private manifest: CleanupFolderManifest = { ...EMPTY_MANIFEST, reasonFolderIds: {} };

  public readonly records = signal<Readonly<Record<string, QuarantineRecord>>>({});
  public readonly ready = signal(false);

  constructor() {
    this.load();
    merge(this.provider.onMovedEvent$, this.provider.onRemovedEvent$)
      .pipe(debounceTime(0), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.bulkMutations.isActive()) {
          void this.reconcileRecords();
        }
      });
  }

  public async quarantine(options: QuarantineOptions): Promise<BulkMutationResult<chrome.bookmarks.BookmarkTreeNode>> {
    const tree = await this.provider.getBookmarks();
    const nodeMap = flattenTree(tree);
    const folders = await this.ensureFolders(tree, options.actionReason);
    const candidates = Array.from(new Map(options.items.map(item => [item.id, item])).values())
      .map(item => nodeMap.get(item.id))
      .filter((item): item is chrome.bookmarks.BookmarkTreeNode => Boolean(item))
      .filter(item => item.id !== options.duplicateKeeperId)
      .filter(item => this.isActionableNode(item, nodeMap, folders.trashId));

    if (options.duplicateKeeperId) {
      this.mergeDuplicateTags(
        options.duplicateKeeperId,
        options.duplicateBookmarkIds ?? candidates.map(item => item.id)
      );
    }

    const pendingRecords = new Map(candidates.map(item => [item.id, {
      nodeId: item.id,
      actionReason: options.actionReason,
      matchedReasons: normalizeReasons([
        ...(options.matchedReasonsById?.[item.id] ?? []),
        options.actionReason
      ]),
      originalParentId: item.parentId ?? folders.otherBookmarksId,
      originalIndex: item.index ?? 0,
      quarantinedAt: Date.now()
    } satisfies QuarantineRecord]));

    const result = await this.bulkMutations.run({
      operation: 'cleanup-quarantine',
      items: candidates,
      identify: item => item.id,
      concurrency: 1,
      execute: item => this.provider.move(item.id, { parentId: folders.reasonFolderId! })
    });
    const updates = { ...this.records() };
    result.results.forEach((moved, index) => {
      if (moved) {
        updates[candidates[index].id] = pendingRecords.get(candidates[index].id)!;
      }
    });
    this.saveRecords(updates);
    this.throwIfIncomplete(result);
    return result;
  }

  public async restore(nodeIds: readonly string[]): Promise<BulkMutationResult<chrome.bookmarks.BookmarkTreeNode>> {
    const selected = Array.from(new Set(nodeIds))
      .map(nodeId => this.records()[nodeId])
      .filter((record): record is QuarantineRecord => Boolean(record))
      .sort((left, right) => left.originalParentId === right.originalParentId
        ? left.originalIndex - right.originalIndex || compareStable(left.nodeId, right.nodeId)
        : compareStable(left.originalParentId, right.originalParentId));
    const tree = await this.provider.getBookmarks();
    const nodeMap = flattenTree(tree);
    const folders = await this.ensureFolders(tree);
    const fallbackId = await this.ensureRestoredFolder(tree, folders.otherBookmarksId);

    const result = await this.bulkMutations.run({
      operation: 'cleanup-restore',
      items: selected,
      identify: record => record.nodeId,
      concurrency: 1,
      execute: record => {
        const originalParent = nodeMap.get(record.originalParentId);
        const canRestoreOriginal = Boolean(originalParent
          && !originalParent.url
          && !this.isManaged(originalParent, nodeMap)
          && !this.isInside(record.originalParentId, folders.trashId, nodeMap));
        return this.provider.move(record.nodeId, canRestoreOriginal
          ? { parentId: record.originalParentId, index: record.originalIndex }
          : { parentId: fallbackId });
      }
    });
    const updates = { ...this.records() };
    result.results.forEach((restored, index) => {
      if (restored) {
        delete updates[selected[index].nodeId];
      }
    });
    this.saveRecords(updates);
    this.throwIfIncomplete(result);
    return result;
  }

  public async purge(nodeIds: readonly string[]): Promise<BulkMutationResult<string>> {
    const selectedIds = Array.from(new Set(nodeIds)).filter(nodeId => Boolean(this.records()[nodeId]));
    if (selectedIds.length === 0) {
      return this.emptyPurge();
    }

    const tree = await this.provider.getBookmarks();
    const nodeMap = flattenTree(tree);
    const cleanupId = this.findValidCleanupId(nodeMap);
    const selectedNodes = selectedIds
      .map(nodeId => nodeMap.get(nodeId))
      .filter((node): node is chrome.bookmarks.BookmarkTreeNode => Boolean(
        node && cleanupId && this.isInside(node.id, cleanupId, nodeMap)
      ));
    const validSelectedIds = new Set(selectedNodes.map(node => node.id));
    if (validSelectedIds.size !== selectedIds.length) {
      const updates = { ...this.records() };
      selectedIds.filter(nodeId => !validSelectedIds.has(nodeId)).forEach(nodeId => {
        delete updates[nodeId];
      });
      this.saveRecords(updates);
    }
    if (selectedNodes.length === 0) {
      return this.emptyPurge();
    }

    await this.importExport.exportJson();
    const descendantsById = new Map(selectedIds.map(nodeId => [
      nodeId,
      collectSubtreeIds(nodeId, nodeMap)
    ]));

    const result = await this.bulkMutations.run({
      operation: 'cleanup-purge',
      items: selectedNodes,
      identify: node => node.id,
      concurrency: 4,
      execute: async node => {
        if (node.url) {
          await this.provider.remove(node.id);
        } else {
          await this.provider.removeTree(node.id);
        }
        return node.id;
      }
    });
    const successfulRootIds = result.results.filter((nodeId): nodeId is string => Boolean(nodeId));
    const deletedIds = new Set(successfulRootIds.flatMap(nodeId => descendantsById.get(nodeId) ?? [nodeId]));
    this.tagsService.setTagsForBookmarks(Object.fromEntries([...deletedIds].map(nodeId => [nodeId, []])));
    this.usefulnessService.setRatingsForBookmarks(
      Object.fromEntries([...deletedIds].map(nodeId => [nodeId, null]))
    );
    const updates = { ...this.records() };
    for (const nodeId of deletedIds) {
      delete updates[nodeId];
    }
    this.saveRecords(updates);
    this.throwIfIncomplete(result);
    return result;
  }

  public async reconcileRecords(): Promise<void> {
    const current = this.records();
    if (Object.keys(current).length === 0) {
      return;
    }
    const tree = await this.provider.getBookmarks();
    const nodeMap = flattenTree(tree);
    const cleanupId = this.findValidCleanupId(nodeMap);
    const updates: Record<string, QuarantineRecord> = {};
    if (cleanupId) {
      for (const [nodeId, record] of Object.entries(current)) {
        if (nodeMap.has(nodeId) && this.isInside(nodeId, cleanupId, nodeMap)) {
          updates[nodeId] = record;
        }
      }
    }
    if (Object.keys(updates).length !== Object.keys(current).length) {
      this.saveRecords(updates);
    }
  }

  private mergeDuplicateTags(keeperId: string, duplicateBookmarkIds: readonly string[]): void {
    const tags = Array.from(new Set(
      [keeperId, ...duplicateBookmarkIds].flatMap(nodeId =>
        this.tagsService.getTagsForBookmark(nodeId))
    ));
    this.tagsService.setTagsForBookmark(keeperId, tags);
  }

  private async ensureFolders(
    tree: chrome.bookmarks.BookmarkTreeNode[],
    reason?: ActionableCleanupReason
  ): Promise<CleanupFolders> {
    const nodeMap = flattenTree(tree);
    const root = tree[0];
    const other = root?.children?.find(node => node.id === '2')
      ?? root?.children?.find(node => node.title === 'Other Bookmarks' && !node.url)
      ?? root?.children?.filter(node => !node.url)[1];
    if (!other || other.url) {
      throw new Error('Other Bookmarks folder was not found');
    }

    const storedTrash = this.manifest.trashId ? nodeMap.get(this.manifest.trashId) : undefined;
    const trash = storedTrash?.parentId === other.id && storedTrash.title === 'Trash' && !storedTrash.url
      ? storedTrash
      : firstDirectFolder(other, 'Trash')
        ?? await this.provider.create({ parentId: other.id, title: 'Trash' });
    const storedCleanup = this.manifest.cleanupId ? nodeMap.get(this.manifest.cleanupId) : undefined;
    const cleanup = storedCleanup?.parentId === trash.id && storedCleanup.title === 'Cleanup' && !storedCleanup.url
      ? storedCleanup
      : firstDirectFolder(trash, 'Cleanup')
        ?? await this.provider.create({ parentId: trash.id, title: 'Cleanup' });

    let reasonFolder: chrome.bookmarks.BookmarkTreeNode | undefined;
    if (reason) {
      const storedReasonId = this.manifest.reasonFolderIds[reason];
      const storedReason = storedReasonId ? nodeMap.get(storedReasonId) : undefined;
      reasonFolder = storedReason?.parentId === cleanup.id
        && storedReason.title === REASON_FOLDER_NAMES[reason]
        && !storedReason.url
        ? storedReason
        : firstDirectFolder(cleanup, REASON_FOLDER_NAMES[reason])
          ?? await this.provider.create({
            parentId: cleanup.id,
            title: REASON_FOLDER_NAMES[reason]
          });
    }

    this.manifest = {
      ...this.manifest,
      trashId: trash.id,
      cleanupId: cleanup.id,
      reasonFolderIds: {
        ...this.manifest.reasonFolderIds,
        ...(reason && reasonFolder ? { [reason]: reasonFolder.id } : {})
      }
    };
    this.persist();
    return {
      otherBookmarksId: other.id,
      trashId: trash.id,
      cleanupId: cleanup.id,
      ...(reasonFolder ? { reasonFolderId: reasonFolder.id } : {})
    };
  }

  private async ensureRestoredFolder(
    tree: chrome.bookmarks.BookmarkTreeNode[],
    otherBookmarksId: string
  ): Promise<string> {
    const nodeMap = flattenTree(tree);
    const stored = this.manifest.restoredId ? nodeMap.get(this.manifest.restoredId) : undefined;
    if (stored?.parentId === otherBookmarksId && stored.title === 'Restored from Cleanup' && !stored.url) {
      return stored.id;
    }
    const other = nodeMap.get(otherBookmarksId);
    const restored = other ? firstDirectFolder(other, 'Restored from Cleanup') : undefined;
    const folder = restored ?? await this.provider.create({
      parentId: otherBookmarksId,
      title: 'Restored from Cleanup'
    });
    this.manifest = { ...this.manifest, restoredId: folder.id };
    this.persist();
    return folder.id;
  }

  private isActionableNode(
    node: chrome.bookmarks.BookmarkTreeNode,
    nodeMap: ReadonlyMap<string, chrome.bookmarks.BookmarkTreeNode>,
    trashId: string
  ): boolean {
    return !this.isPermanentRoot(node, nodeMap)
      && !this.isManaged(node, nodeMap)
      && !this.isInside(node.id, trashId, nodeMap);
  }

  private isPermanentRoot(
    node: chrome.bookmarks.BookmarkTreeNode,
    nodeMap: ReadonlyMap<string, chrome.bookmarks.BookmarkTreeNode>
  ): boolean {
    return !node.url && (node.parentId === undefined
      || nodeMap.get(node.parentId)?.parentId === undefined);
  }

  private isManaged(
    node: chrome.bookmarks.BookmarkTreeNode,
    nodeMap: ReadonlyMap<string, chrome.bookmarks.BookmarkTreeNode>
  ): boolean {
    let current: chrome.bookmarks.BookmarkTreeNode | undefined = node;
    while (current) {
      if (current.unmodifiable === 'managed') {
        return true;
      }
      current = current.parentId ? nodeMap.get(current.parentId) : undefined;
    }
    return false;
  }

  private isInside(
    nodeId: string,
    ancestorId: string,
    nodeMap: ReadonlyMap<string, chrome.bookmarks.BookmarkTreeNode>
  ): boolean {
    let current = nodeMap.get(nodeId);
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      if (current.id === ancestorId) {
        return true;
      }
      visited.add(current.id);
      current = current.parentId ? nodeMap.get(current.parentId) : undefined;
    }
    return false;
  }

  private findValidCleanupId(
    nodeMap: ReadonlyMap<string, chrome.bookmarks.BookmarkTreeNode>
  ): string | undefined {
    const cleanup = this.manifest.cleanupId ? nodeMap.get(this.manifest.cleanupId) : undefined;
    if (cleanup && cleanup.title === 'Cleanup' && !cleanup.url) {
      const trash = cleanup.parentId ? nodeMap.get(cleanup.parentId) : undefined;
      if (trash?.title === 'Trash' && !trash.url) {
        return cleanup.id;
      }
    }
    for (const candidate of nodeMap.values()) {
      if (candidate.title !== 'Cleanup' || candidate.url || !candidate.parentId) {
        continue;
      }
      const trash = nodeMap.get(candidate.parentId);
      const other = trash?.parentId ? nodeMap.get(trash.parentId) : undefined;
      if (trash?.title === 'Trash'
        && !trash.url
        && other
        && !other.url
        && (other.id === '2' || other.title === 'Other Bookmarks')) {
        this.manifest = { ...this.manifest, trashId: trash.id, cleanupId: candidate.id };
        this.persist();
        return candidate.id;
      }
    }
    return undefined;
  }

  private emptyPurge(): Promise<BulkMutationResult<string>> {
    return this.bulkMutations.run({
      operation: 'cleanup-purge',
      items: [] as string[],
      identify: nodeId => nodeId,
      execute: async nodeId => nodeId
    });
  }

  private throwIfIncomplete<T>(result: BulkMutationResult<T>): void {
    if (result.cancelled || result.failures.length > 0) {
      throw new BulkMutationError(result);
    }
  }

  private load(): void {
    const apply = (value: unknown) => {
      const normalized = normalizeQuarantineStorage(value);
      this.manifest = normalized.folders;
      this.records.set(normalized.records);
      this.ready.set(true);
    };
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([STORAGE_KEY], result => apply(result[STORAGE_KEY]));
      return;
    }
    try {
      apply(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
    } catch {
      apply(null);
    }
  }

  private saveRecords(records: Record<string, QuarantineRecord>): void {
    this.records.set(records);
    this.persist();
  }

  private persist(): void {
    const storage: QuarantineStorage = {
      version: 1,
      records: { ...this.records() },
      folders: {
        ...this.manifest,
        reasonFolderIds: { ...this.manifest.reasonFolderIds }
      }
    };
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      void chrome.storage.local.set({ [STORAGE_KEY]: storage });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    }
  }
}

function normalizeQuarantineStorage(value: unknown): QuarantineStorage {
  if (!isRecord(value) || value['version'] !== 1) {
    return emptyStorage();
  }
  const records: Record<string, QuarantineRecord> = {};
  if (isRecord(value['records'])) {
    for (const [nodeId, record] of Object.entries(value['records'])) {
      const normalized = normalizeQuarantineRecord(record);
      if (normalized?.nodeId === nodeId) {
        records[nodeId] = normalized;
      }
    }
  }
  const foldersValue = value['folders'];
  const reasonFolderIds: Partial<Record<ActionableCleanupReason, string>> = {};
  if (isRecord(foldersValue) && isRecord(foldersValue['reasonFolderIds'])) {
    for (const reason of Object.keys(REASON_FOLDER_NAMES) as ActionableCleanupReason[]) {
      const id = foldersValue['reasonFolderIds'][reason];
      if (typeof id === 'string' && id) {
        reasonFolderIds[reason] = id;
      }
    }
  }
  return {
    version: 1,
    records,
    folders: {
      version: 1,
      ...(isRecord(foldersValue) && typeof foldersValue['trashId'] === 'string'
        ? { trashId: foldersValue['trashId'] }
        : {}),
      ...(isRecord(foldersValue) && typeof foldersValue['cleanupId'] === 'string'
        ? { cleanupId: foldersValue['cleanupId'] }
        : {}),
      ...(isRecord(foldersValue) && typeof foldersValue['restoredId'] === 'string'
        ? { restoredId: foldersValue['restoredId'] }
        : {}),
      reasonFolderIds
    }
  };
}

function normalizeQuarantineRecord(value: unknown): QuarantineRecord | null {
  if (!isRecord(value)
    || typeof value['nodeId'] !== 'string'
    || !isActionableReason(value['actionReason'])
    || !Array.isArray(value['matchedReasons'])
    || !value['matchedReasons'].every(isCleanupReason)
    || typeof value['originalParentId'] !== 'string'
    || typeof value['originalIndex'] !== 'number'
    || !Number.isInteger(value['originalIndex'])
    || value['originalIndex'] < 0
    || typeof value['quarantinedAt'] !== 'number'
    || !Number.isFinite(value['quarantinedAt'])) {
    return null;
  }
  return {
    nodeId: value['nodeId'],
    actionReason: value['actionReason'],
    matchedReasons: normalizeReasons(value['matchedReasons']),
    originalParentId: value['originalParentId'],
    originalIndex: value['originalIndex'],
    quarantinedAt: value['quarantinedAt']
  };
}

function flattenTree(
  tree: readonly chrome.bookmarks.BookmarkTreeNode[]
): Map<string, chrome.bookmarks.BookmarkTreeNode> {
  const result = new Map<string, chrome.bookmarks.BookmarkTreeNode>();
  const stack = [...tree];
  while (stack.length > 0) {
    const node = stack.pop()!;
    result.set(node.id, node);
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return result;
}

function firstDirectFolder(
  parent: chrome.bookmarks.BookmarkTreeNode,
  title: string
): chrome.bookmarks.BookmarkTreeNode | undefined {
  return [...(parent.children ?? [])]
    .filter(node => !node.url && node.title === title)
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))[0];
}

function collectSubtreeIds(
  nodeId: string,
  nodeMap: ReadonlyMap<string, chrome.bookmarks.BookmarkTreeNode>
): string[] {
  const root = nodeMap.get(nodeId);
  if (!root) {
    return [nodeId];
  }
  const ids: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    ids.push(node.id);
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return ids;
}

function normalizeReasons(reasons: readonly CleanupReason[]): CleanupReason[] {
  return Array.from(new Set(reasons)).sort(compareStable);
}

function isCleanupReason(value: unknown): value is CleanupReason {
  return value === 'exact-duplicate'
    || value === 'probable-duplicate'
    || value === 'stale'
    || value === 'unknown-usage'
    || value === 'untagged'
    || value === 'unrated'
    || value === 'low-usefulness'
    || value === 'empty-folder'
    || value === 'quarantined';
}

function isActionableReason(value: unknown): value is ActionableCleanupReason {
  return isCleanupReason(value) && value !== 'quarantined';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareStable(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function emptyStorage(): QuarantineStorage {
  return {
    version: 1,
    records: {},
    folders: { ...EMPTY_MANIFEST, reasonFolderIds: {} }
  };
}
