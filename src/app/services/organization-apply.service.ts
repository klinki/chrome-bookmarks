import { inject, Injectable } from '@angular/core';
import { BookmarksProviderService } from './bookmarks-provider.service';
import { BulkMutationCoordinatorService, BulkMutationError } from './bulk-mutation-coordinator.service';
import { ImportExportService } from './import-export.service';
import { OrganizationStorageService } from './organization-storage.service';
import { OrganizationPlan, OrganizationUndoJournal } from './organization.types';
import { TagsService } from './tags.service';

@Injectable({ providedIn: 'root' })
export class OrganizationApplyService {
  private provider = inject(BookmarksProviderService);
  private coordinator = inject(BulkMutationCoordinatorService);
  private tags = inject(TagsService);
  private backups = inject(ImportExportService);
  private storage = inject(OrganizationStorageService);

  public async apply(plan: OrganizationPlan, replaceUndoJournal = false): Promise<OrganizationUndoJournal> {
    const existingJournal = await this.storage.getUndoJournal();
    if (existingJournal && !replaceUndoJournal) throw new Error('An undo record already exists and would be replaced.');
    const tree = await this.provider.getBookmarks();
    const map = flatten(tree);
    const destination = map.get(plan.destinationRootId);
    if (!destination || destination.url) throw new Error('Destination root no longer exists.');
    const selected = plan.proposals.filter(proposal => proposal.selected && !proposal.excluded);
    const conflicts = selected.filter(proposal => !map.get(proposal.bookmarkId)?.url);
    if (conflicts.length > 0) throw new Error(`${conflicts.length} selected proposals are stale and require review.`);
    if (selected.some(proposal => proposal.destinationPath.length < 1 || proposal.destinationPath.length > 2)) {
      throw new Error('Proposed folder paths must contain one or two levels.');
    }

    await this.backups.exportJson();
    const createdFolderIds: string[] = [];
    const destinationByPath = new Map<string, string>();
    const moves: OrganizationUndoJournal['moves'] = [];
    const tagChanges = new Map<string, { before: string[]; after: string[] }>();
    try {
      for (const proposal of selected) {
        const destinationId = await this.ensurePath(destination, proposal.destinationPath, map, destinationByPath, createdFolderIds);
        const bookmark = map.get(proposal.bookmarkId)!;
        const before = this.tags.getTagsForBookmark(bookmark.id);
        const after = unique([...before, ...proposal.addTags]);
        tagChanges.set(bookmark.id, { before, after });
        if (bookmark.parentId !== destinationId) {
          moves.push({ bookmarkId: bookmark.id, fromParentId: bookmark.parentId!, toParentId: destinationId });
        }
      }
      for (const consolidation of plan.tagConsolidations.filter(item => item.selected)) {
        for (const bookmark of map.values()) {
          if (!bookmark.url) continue;
          const before = tagChanges.get(bookmark.id)?.after ?? this.tags.getTagsForBookmark(bookmark.id);
          if (!before.some(tag => consolidation.synonyms.includes(tag))) continue;
          const after = unique([...before.filter(tag => !consolidation.synonyms.includes(tag)), consolidation.canonical]);
          const original = tagChanges.get(bookmark.id)?.before ?? this.tags.getTagsForBookmark(bookmark.id);
          tagChanges.set(bookmark.id, { before: original, after });
        }
      }
      const tagResult = await this.coordinator.run({
        operation: 'organization-tags', items: [...tagChanges.entries()], identify: ([id]) => id,
        concurrency: 32, execute: async ([id, change]) => { this.tags.setTagsForBookmark(id, change.after); return id; }
      });
      if (tagResult.failures.length || tagResult.cancelled) throw new BulkMutationError(tagResult);
      const moveResult = await this.coordinator.run({
        operation: 'organization-moves', items: moves, identify: move => move.bookmarkId,
        concurrency: 8, execute: move => this.provider.move(move.bookmarkId, { parentId: move.toParentId })
      });
      if (moveResult.failures.length || moveResult.cancelled) throw new BulkMutationError(moveResult);
      const journal: OrganizationUndoJournal = {
        version: 1, appliedAt: Date.now(), moves,
        tags: [...tagChanges.entries()].map(([bookmarkId, value]) => ({ bookmarkId, ...value })), createdFolderIds
      };
      await this.storage.setUndoJournal(journal);
      return journal;
    } catch (error) {
      await this.rollback(moves, tagChanges, createdFolderIds);
      throw error;
    }
  }

  public async undo(): Promise<{ restored: number; conflicts: number }> {
    const journal = await this.storage.getUndoJournal();
    if (!journal) throw new Error('There is no organization action to undo.');
    const map = flatten(await this.provider.getBookmarks());
    let restored = 0; let conflicts = 0;
    for (const move of [...journal.moves].reverse()) {
      const node = map.get(move.bookmarkId);
      if (node?.parentId !== move.toParentId || !map.get(move.fromParentId)) { conflicts++; continue; }
      await this.provider.move(move.bookmarkId, { parentId: move.fromParentId }); restored++;
    }
    for (const change of journal.tags) {
      if (!sameTags(this.tags.getTagsForBookmark(change.bookmarkId), change.after)) { conflicts++; continue; }
      this.tags.setTagsForBookmark(change.bookmarkId, change.before); restored++;
    }
    for (const folderId of [...journal.createdFolderIds].reverse()) {
      const folder = flatten(await this.provider.getBookmarks()).get(folderId);
      if (!folder || (folder.children?.length ?? 0) > 0) { if (folder) conflicts++; continue; }
      await this.provider.removeTree(folderId); restored++;
    }
    await this.storage.setUndoJournal(null);
    return { restored, conflicts };
  }

  private async ensurePath(root: chrome.bookmarks.BookmarkTreeNode, path: string[], map: Map<string, chrome.bookmarks.BookmarkTreeNode>, cache: Map<string, string>, created: string[]): Promise<string> {
    let parent = root;
    for (const name of path) {
      const key = `${parent.id}/${name.toLocaleLowerCase()}`;
      const cached = cache.get(key); if (cached) { parent = map.get(cached)!; continue; }
      let folder = parent.children?.find(child => !child.url && child.title.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (!folder) {
        const result = await this.coordinator.run({
          operation: 'organization-folders', items: [{ parentId: parent.id, title: name }],
          identify: item => `${item.parentId}/${item.title}`, concurrency: 1,
          execute: item => this.provider.create(item)
        });
        folder = result.results[0];
        if (!folder || result.failures.length || result.cancelled) throw new BulkMutationError(result);
        folder.children = []; parent.children = [...(parent.children ?? []), folder]; map.set(folder.id, folder); created.push(folder.id);
      }
      cache.set(key, folder.id); parent = folder;
    }
    return parent.id;
  }

  private async rollback(moves: OrganizationUndoJournal['moves'], tags: Map<string, {before:string[];after:string[]}>, folders: string[]): Promise<void> {
    for (const move of [...moves].reverse()) { try { await this.provider.move(move.bookmarkId, { parentId: move.fromParentId }); } catch {} }
    tags.forEach((change, id) => this.tags.setTagsForBookmark(id, change.before));
    for (const id of [...folders].reverse()) {
      try {
        const folder = flatten(await this.provider.getBookmarks()).get(id);
        if (folder && (folder.children?.length ?? 0) === 0) await this.provider.removeTree(id);
      } catch {}
    }
  }
}

function flatten(tree: readonly chrome.bookmarks.BookmarkTreeNode[]): Map<string, chrome.bookmarks.BookmarkTreeNode> {
  const map = new Map<string, chrome.bookmarks.BookmarkTreeNode>(); const stack = [...tree];
  while (stack.length) { const node = stack.pop()!; map.set(node.id, node); stack.push(...(node.children ?? [])); }
  return map;
}
function unique(values: string[]): string[] { return [...new Set(values)]; }
function sameTags(a: string[], b: string[]): boolean { return a.length === b.length && a.every((value, index) => value === b[index]); }
