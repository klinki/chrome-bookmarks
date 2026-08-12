import { Injectable, inject, signal } from '@angular/core';
import { BookmarksProviderService } from './bookmarks-provider.service';
import { TagsService, BookmarkTags } from './tags.service';
import {
  BookmarkUsefulness,
  UsefulnessRating,
  UsefulnessService,
  isUsefulnessScore
} from './usefulness.service';
import { SmartCollectionsService } from './smart-collections.service';
import { SmartCollection } from './search.types';

export interface BackupData {
  version: number;
  root: chrome.bookmarks.BookmarkTreeNode[];
  tags: BookmarkTags;
  usefulness: BookmarkUsefulness;
  smartCollections: SmartCollection[];
}

interface JsonImportPlan {
  nodes: ImportNode[];
  smartCollections: SmartCollection[];
}

interface ImportNode {
  sourceId?: string;
  title: string;
  url?: string;
  tags: string[];
  usefulness?: UsefulnessRating;
  children: ImportNode[];
}

const MAX_IMPORT_DEPTH = 100;
const MAX_IMPORT_NODES = 100_000;

@Injectable({
  providedIn: 'root'
})
export class ImportExportService {
  private bookmarksProvider = inject(BookmarksProviderService);
  private tagsService = inject(TagsService);
  private usefulnessService = inject(UsefulnessService);
  private smartCollectionsService = inject(SmartCollectionsService);
  public readonly importWarnings = signal<ReadonlyArray<string>>([]);


  public async exportJson() {
    const tree = await this.bookmarksProvider.getBookmarks();
    const tags = this.tagsService.bookmarkTags();
    const usefulness = this.usefulnessService.bookmarkUsefulness();

    const data: BackupData = {
      version: 3,
      root: tree,
      tags,
      usefulness,
      smartCollections: [...this.smartCollectionsService.collections()]
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.downloadFile(blob, `bookmarks_backup_${new Date().toISOString().split('T')[0]}.json`);
  }

  public async importJson(file: File): Promise<void> {
    this.importWarnings.set([]);
    const text = await file.text();
    const plan = this.parseJsonImport(JSON.parse(text) as unknown);
    await this.executeImport(
      plan.nodes,
      `Imported ${new Date().toLocaleString()}`,
      plan.smartCollections
    );
  }

  private parseJsonImport(value: unknown): JsonImportPlan {
    if (!this.isRecord(value)
      || (value['version'] !== 1 && value['version'] !== 2 && value['version'] !== 3)
      || !Array.isArray(value['root'])) {
      throw new Error('Invalid backup file format');
    }

    const tagsById = new Map<string, string[]>();
    const rawTags = value['tags'];
    if (rawTags != null) {
      if (!this.isRecord(rawTags)) {
        throw new Error('Invalid backup tags');
      }
      for (const [id, tags] of Object.entries(rawTags)) {
        if (!Array.isArray(tags)
          || tags.some(tag => typeof tag !== 'string' || tag.trim() === '')) {
          throw new Error(`Invalid tags for bookmark ${id}`);
        }
        tagsById.set(id, [...tags]);
      }
    }

    const usefulnessById = new Map<string, UsefulnessRating>();
    if (value['version'] === 2 || value['version'] === 3) {
      const rawUsefulness = value['usefulness'];
      if (!this.isRecord(rawUsefulness)) {
        throw new Error('Invalid backup usefulness ratings');
      }
      for (const [id, rating] of Object.entries(rawUsefulness)) {
        if (!this.isUsefulnessRating(rating)) {
          throw new Error(`Invalid usefulness rating for bookmark ${id}`);
        }
        usefulnessById.set(id, { ...rating });
      }
    }

    const seenIds = new Set<string>();
    const count = { value: 0 };
    const roots = value['root'].map(node =>
      this.parseJsonNode(node, tagsById, usefulnessById, seenIds, count, 0));
    for (const bookmarkId of usefulnessById.keys()) {
      if (!seenIds.has(bookmarkId)) {
        throw new Error(`Usefulness rating references unknown bookmark ${bookmarkId}`);
      }
    }

    const smartCollections: SmartCollection[] = [];
    if (value['version'] === 3) {
      if (!Array.isArray(value['smartCollections'])) {
        throw new Error('Invalid backup Smart Collections');
      }
      const ids = new Set<string>();
      const names = new Set<string>();
      for (const rawCollection of value['smartCollections']) {
        if (!this.smartCollectionsService.isSmartCollection(rawCollection)) {
          throw new Error('Invalid Smart Collection in backup');
        }
        const name = rawCollection.name.toLocaleLowerCase();
        if (ids.has(rawCollection.id) || names.has(name)) {
          throw new Error('Duplicate Smart Collection in backup');
        }
        ids.add(rawCollection.id);
        names.add(name);
        smartCollections.push({ ...rawCollection });
      }
    }
    const nodes = roots.length === 1 && roots[0].sourceId === '0'
      ? roots[0].children
      : roots;
    return { nodes, smartCollections };
  }

  private parseJsonNode(
    value: unknown,
    tagsById: Map<string, string[]>,
    usefulnessById: Map<string, UsefulnessRating>,
    seenIds: Set<string>,
    count: { value: number },
    depth: number
  ): ImportNode {
    this.countImportNode(count, depth);
    if (!this.isRecord(value)
      || typeof value['id'] !== 'string'
      || value['id'].trim() === ''
      || typeof value['title'] !== 'string') {
      throw new Error('Invalid bookmark node');
    }

    const id = value['id'];
    if (seenIds.has(id)) {
      throw new Error(`Duplicate bookmark ID: ${id}`);
    }
    seenIds.add(id);

    const rawUrl = value['url'];
    const rawChildren = value['children'];
    if (rawUrl != null && typeof rawUrl !== 'string') {
      throw new Error(`Invalid bookmark URL for ${id}`);
    }
    if (rawChildren != null && !Array.isArray(rawChildren)) {
      throw new Error(`Invalid bookmark children for ${id}`);
    }
    if (typeof rawUrl === 'string' && rawChildren != null) {
      throw new Error(`Bookmark ${id} cannot contain children`);
    }
    if (typeof rawUrl === 'string') {
      this.validateBookmarkUrl(rawUrl);
    }
    if (usefulnessById.has(id) && typeof rawUrl !== 'string') {
      throw new Error(`Usefulness rating cannot be assigned to folder ${id}`);
    }

    return {
      sourceId: id,
      title: value['title'],
      ...(typeof rawUrl === 'string' ? { url: rawUrl } : {}),
      tags: tagsById.get(id) ?? [],
      ...(usefulnessById.has(id) ? { usefulness: usefulnessById.get(id) } : {}),
      children: Array.isArray(rawChildren)
        ? rawChildren.map(child =>
          this.parseJsonNode(
            child,
            tagsById,
            usefulnessById,
            seenIds,
            count,
            depth + 1
          ))
        : []
    };
  }


  private async executeImport(
    nodes: ImportNode[],
    title: string,
    smartCollections: readonly SmartCollection[] = []
  ): Promise<void> {
    const [root] = await this.bookmarksProvider.getBookmarks();
    const destination = root?.children?.[0];
    if (!destination || destination.url) {
      throw new Error('Bookmarks bar folder was not found');
    }

    const originalAvailableTags = [...this.tagsService.availableTags()];
    const originalCollections = [...this.smartCollectionsService.collections()];
    const createdIds: string[] = [];
    const importedTags: Record<string, string[]> = {};
    const importedUsefulness: Record<string, UsefulnessRating> = {};
    const importedAvailableTags = new Set<string>();
    const sourceToCreatedId = new Map<string, string>();
    let importFolder: chrome.bookmarks.BookmarkTreeNode | undefined;

    try {
      importFolder = await this.bookmarksProvider.create({
        parentId: destination.id,
        title
      });
      createdIds.push(importFolder.id);
      await this.importNodesWithTracking(
        nodes,
        importFolder.id,
        createdIds,
        importedTags,
        importedUsefulness,
        importedAvailableTags,
        sourceToCreatedId
      );
      this.tagsService.setTagsForBookmarks(importedTags);
      this.tagsService.addAvailableTags(importedAvailableTags);
      this.usefulnessService.setRatingsForBookmarks(importedUsefulness);
      this.importWarnings.set(this.smartCollectionsService.mergeImported(
        smartCollections,
        sourceToCreatedId
      ));
    } catch (error) {
      if (!importFolder) {
        throw error;
      }

      const rollbackErrors: unknown[] = [];
      try {
        await this.bookmarksProvider.removeTree(importFolder.id);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }

      try {
        this.tagsService.setTagsForBookmarks(
          Object.fromEntries(createdIds.map(id => [id, []]))
        );
        this.tagsService.setAvailableTags(originalAvailableTags);
        this.usefulnessService.setRatingsForBookmarks(
          Object.fromEntries(createdIds.map(id => [id, null]))
        );
        this.smartCollectionsService.replaceAll(originalCollections);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }

      if (rollbackErrors.length > 0) {
        throw new AggregateError(
          [error, ...rollbackErrors],
          'Bookmark import failed and could not be fully rolled back'
        );
      }
      throw error;
    }
  }

  private async importNodesWithTracking(
    nodes: ImportNode[],
    parentId: string,
    createdIds: string[],
    importedTags: Record<string, string[]>,
    importedUsefulness: Record<string, UsefulnessRating>,
    importedAvailableTags: Set<string>,
    sourceToCreatedId: Map<string, string>
  ): Promise<void> {
    for (const node of nodes) {
      const created = await this.bookmarksProvider.create({
        parentId,
        title: node.title,
        ...(node.url ? { url: node.url } : {})
      });
      createdIds.push(created.id);
      if (node.sourceId) {
        sourceToCreatedId.set(node.sourceId, created.id);
      }

      if (node.tags.length > 0) {
        importedTags[created.id] = node.tags;
        node.tags.forEach(tag => importedAvailableTags.add(tag));
      }
      if (node.usefulness) {
        importedUsefulness[created.id] = { ...node.usefulness };
      }

      await this.importNodesWithTracking(
        node.children,
        created.id,
        createdIds,
        importedTags,
        importedUsefulness,
        importedAvailableTags,
        sourceToCreatedId
      );
    }
  }

  private downloadFile(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  public async exportHtml() {
    const tree = await this.bookmarksProvider.getBookmarks();
    // tree is [root]. root children are Bar, Other.

    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

    const nodesToExport = tree[0]?.children || tree;
    for (const node of nodesToExport) {
        html += this.nodeToHtml(node, 1);
    }

    html += `</DL><p>`;

    const blob = new Blob([html], { type: 'text/html' });
    this.downloadFile(blob, `bookmarks_${new Date().toISOString().split('T')[0]}.html`);
  }

  private nodeToHtml(node: chrome.bookmarks.BookmarkTreeNode, indentLevel: number): string {
      const indent = '    '.repeat(indentLevel);
      let html = '';

      if (node.url) {
          const tags = this.tagsService.getTagsForBookmark(node.id);
          const escapedTags = tags.map(t => this.escapeHtml(t)).join(',');
          const tagsAttr = tags.length > 0 ? ` TAGS="${escapedTags}"` : '';
          const addDate = node.dateAdded ? ` ADD_DATE="${Math.floor(node.dateAdded / 1000)}"` : '';

          html += `${indent}<DT><A HREF="${this.escapeHtml(node.url)}"${addDate}${tagsAttr}>${this.escapeHtml(node.title)}</A>\n`;
      } else {
          // Folder
          const addDate = node.dateAdded ? ` ADD_DATE="${Math.floor(node.dateAdded / 1000)}"` : '';
          const lastMod = node.dateGroupModified ? ` LAST_MODIFIED="${Math.floor(node.dateGroupModified / 1000)}"` : '';

          html += `${indent}<DT><H3${addDate}${lastMod}>${this.escapeHtml(node.title)}</H3>\n`;
          html += `${indent}<DL><p>\n`;
          if (node.children) {
              for (const child of node.children) {
                  html += this.nodeToHtml(child, indentLevel + 1);
              }
          }
          html += `${indent}</DL><p>\n`;
      }
      return html;
  }

  private escapeHtml(text: string): string {
      return text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
  }

  public async importHtml(file: File): Promise<void> {
      this.importWarnings.set([]);
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const dl = doc.querySelector('dl');
      if (!dl) {
          throw new Error('Invalid bookmark HTML format');
      }

      const plan = this.parseHtmlNodes(dl, { value: 0 }, 0);
      await this.executeImport(plan, `Imported HTML ${new Date().toLocaleString()}`, []);
  }

  private parseHtmlNodes(dl: Element, count: { value: number }, depth: number): ImportNode[] {
      const result: ImportNode[] = [];
      const children = Array.from(dl.children);

      for (let i = 0; i < children.length; i++) {
          const element = children[i];
          if (element.tagName !== 'DT') {
              continue;
          }

          this.countImportNode(count, depth);
          const directChildren = Array.from(element.children);
          const heading = directChildren.find(child => child.tagName === 'H3');
          const anchor = directChildren.find(child => child.tagName === 'A');

          if ((heading == null) === (anchor == null)) {
              throw new Error('Invalid bookmark HTML entry');
          }

          if (heading) {
              let childList = directChildren.find(child => child.tagName === 'DL');
              if (!childList) {
                  for (let nextIndex = i + 1; nextIndex < children.length; nextIndex++) {
                      const next = children[nextIndex];
                      if (next.tagName === 'DT') {
                          break;
                      }
                      if (next.tagName === 'DL') {
                          childList = next;
                          i = nextIndex;
                          break;
                      }
                  }
              }

              result.push({
                  title: heading.textContent?.trim() || 'Untitled',
                  tags: [],
                  children: childList
                      ? this.parseHtmlNodes(childList, count, depth + 1)
                      : []
              });
              continue;
          }

          const url = anchor!.getAttribute('href');
          if (!url) {
              throw new Error('Bookmark HTML entry is missing a URL');
          }
          this.validateBookmarkUrl(url);
          const tags = (anchor!.getAttribute('tags') ?? '')
              .split(',')
              .map(tag => tag.trim())
              .filter(tag => tag !== '');
          result.push({
              title: anchor!.textContent?.trim() || 'Untitled',
              url,
              tags,
              children: []
          });
      }

      return result;
  }

  private countImportNode(count: { value: number }, depth: number) {
      count.value++;
      if (depth > MAX_IMPORT_DEPTH || count.value > MAX_IMPORT_NODES) {
          throw new Error('Bookmark import exceeds supported size');
      }
  }

  private validateBookmarkUrl(url: string) {
      try {
          new URL(url);
      } catch {
          throw new Error(`Invalid bookmark URL: ${url}`);
      }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
      return typeof value === 'object' && value != null && !Array.isArray(value);
  }

  private isUsefulnessRating(value: unknown): value is UsefulnessRating {
    return this.isRecord(value)
      && isUsefulnessScore(value['score'])
      && (value['source'] === 'ai' || value['source'] === 'manual');
  }
}
