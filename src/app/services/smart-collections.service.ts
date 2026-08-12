import { Injectable, signal } from '@angular/core';
import { parseSearchQuery } from './search-query';
import {
  SEARCH_QUERY_VERSION,
  SmartCollection,
  SmartCollectionSortColumn
} from './search.types';

export interface SmartCollectionInput {
  name: string;
  query: string;
  scopeFolderId?: string;
  sortColumn?: SmartCollectionSortColumn;
  sortDirection?: 'asc' | 'desc';
}

const STORAGE_KEY = 'smartCollections';
const SORT_COLUMNS = new Set<SmartCollectionSortColumn>([
  '', 'title', 'url', 'dateAdded', 'dateLastUsed', 'tags', 'usefulness'
]);

@Injectable({ providedIn: 'root' })
export class SmartCollectionsService {
  public readonly collections = signal<ReadonlyArray<SmartCollection>>([]);
  public readonly ready = signal(false);
  private resolveReady!: () => void;
  private readonly readyPromise = new Promise<void>(resolve => this.resolveReady = resolve);

  constructor() {
    this.load();
  }

  public get(id: string): SmartCollection | undefined {
    return this.collections().find(collection => collection.id === id);
  }

  public whenReady(): Promise<void> {
    return this.readyPromise;
  }

  public create(input: SmartCollectionInput): SmartCollection {
    this.validateInput(input);
    this.assertUniqueName(input.name);
    const now = Date.now();
    const collection: SmartCollection = {
      id: this.createId(),
      name: input.name.trim(),
      query: input.query,
      queryVersion: SEARCH_QUERY_VERSION,
      ...(input.scopeFolderId ? { scopeFolderId: input.scopeFolderId } : {}),
      sortColumn: input.sortColumn ?? 'title',
      sortDirection: input.sortDirection ?? 'asc',
      createdAt: now,
      updatedAt: now
    };
    this.save([...this.collections(), collection]);
    return collection;
  }

  public update(id: string, changes: Partial<SmartCollectionInput>): SmartCollection {
    const existing = this.getRequired(id);
    const scopeWasProvided = Object.prototype.hasOwnProperty.call(changes, 'scopeFolderId');
    const merged: SmartCollectionInput = {
      name: changes.name ?? existing.name,
      query: changes.query ?? existing.query,
      scopeFolderId: scopeWasProvided ? changes.scopeFolderId : existing.scopeFolderId,
      sortColumn: changes.sortColumn ?? existing.sortColumn,
      sortDirection: changes.sortDirection ?? existing.sortDirection
    };
    this.validateInput(merged);
    this.assertUniqueName(merged.name, id);
    const updated: SmartCollection = {
      ...existing,
      ...merged,
      name: merged.name.trim(),
      scopeFolderId: merged.scopeFolderId || undefined,
      updatedAt: Date.now()
    };
    this.save(this.collections().map(collection => collection.id === id ? updated : collection));
    return updated;
  }

  public duplicate(id: string): SmartCollection {
    const source = this.getRequired(id);
    return this.create({
      name: this.availableName(`${source.name} Copy`),
      query: source.query,
      scopeFolderId: source.scopeFolderId,
      sortColumn: source.sortColumn,
      sortDirection: source.sortDirection
    });
  }

  public delete(id: string): void {
    this.save(this.collections().filter(collection => collection.id !== id));
  }

  public replaceAll(collections: readonly SmartCollection[]): void {
    const validated: SmartCollection[] = [];
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const collection of collections) {
      if (!this.isSmartCollection(collection)) {
        throw new Error('Invalid Smart Collection');
      }
      const normalizedName = collection.name.trim().toLocaleLowerCase();
      if (ids.has(collection.id) || names.has(normalizedName)) {
        throw new Error('Duplicate Smart Collection ID or name');
      }
      ids.add(collection.id);
      names.add(normalizedName);
      validated.push({ ...collection });
    }
    this.save(validated);
  }

  public mergeImported(
    imported: readonly SmartCollection[],
    folderIdMap: ReadonlyMap<string, string>
  ): string[] {
    const warnings: string[] = [];
    const merged = [...this.collections()];
    const usedIds = new Set(merged.map(collection => collection.id));
    const usedNames = new Set(merged.map(collection => collection.name.toLocaleLowerCase()));
    for (const collection of imported) {
      let id = collection.id;
      if (usedIds.has(id)) {
        id = this.createId();
      }
      let name = collection.name;
      if (usedNames.has(name.toLocaleLowerCase())) {
        name = this.importedName(name, usedNames);
      }
      const mappedScope = collection.scopeFolderId
        ? folderIdMap.get(collection.scopeFolderId)
        : undefined;
      if (collection.scopeFolderId && !mappedScope) {
        warnings.push(`Smart Collection “${name}” was imported with global scope because its folder was unavailable.`);
      }
      const next = {
        ...collection,
        id,
        name,
        scopeFolderId: mappedScope,
        updatedAt: Date.now()
      };
      usedIds.add(id);
      usedNames.add(name.toLocaleLowerCase());
      merged.push(next);
    }
    this.replaceAll(merged);
    return warnings;
  }

  public isSmartCollection(value: unknown): value is SmartCollection {
    if (!isRecord(value)
      || typeof value['id'] !== 'string' || !value['id']
      || typeof value['name'] !== 'string' || !value['name'].trim()
      || typeof value['query'] !== 'string'
      || value['queryVersion'] !== SEARCH_QUERY_VERSION
      || (value['scopeFolderId'] !== undefined && typeof value['scopeFolderId'] !== 'string')
      || !SORT_COLUMNS.has(value['sortColumn'] as SmartCollectionSortColumn)
      || (value['sortDirection'] !== 'asc' && value['sortDirection'] !== 'desc')
      || typeof value['createdAt'] !== 'number' || !Number.isFinite(value['createdAt'])
      || typeof value['updatedAt'] !== 'number' || !Number.isFinite(value['updatedAt'])) {
      return false;
    }
    try {
      parseSearchQuery(value['query']);
      return true;
    } catch {
      return false;
    }
  }

  private validateInput(input: SmartCollectionInput): void {
    if (!input.name.trim()) {
      throw new Error('Smart Collection name is required');
    }
    parseSearchQuery(input.query);
    if (input.sortColumn !== undefined && !SORT_COLUMNS.has(input.sortColumn)) {
      throw new Error('Invalid Smart Collection sort column');
    }
  }

  private assertUniqueName(name: string, excludingId?: string): void {
    const normalized = name.trim().toLocaleLowerCase();
    if (this.collections().some(collection =>
      collection.id !== excludingId && collection.name.toLocaleLowerCase() === normalized)) {
      throw new Error(`A Smart Collection named “${name.trim()}” already exists`);
    }
  }

  private getRequired(id: string): SmartCollection {
    const collection = this.get(id);
    if (!collection) {
      throw new Error('Smart Collection was not found');
    }
    return collection;
  }

  private availableName(base: string): string {
    const used = new Set(this.collections().map(collection => collection.name.toLocaleLowerCase()));
    if (!used.has(base.toLocaleLowerCase())) {
      return base;
    }
    let suffix = 2;
    while (used.has(`${base} ${suffix}`.toLocaleLowerCase())) {
      suffix++;
    }
    return `${base} ${suffix}`;
  }

  private importedName(base: string, used: Set<string>): string {
    let candidate = `${base} (Imported)`;
    let suffix = 2;
    while (used.has(candidate.toLocaleLowerCase())) {
      candidate = `${base} (Imported) ${suffix++}`;
    }
    return candidate;
  }

  private save(collections: readonly SmartCollection[]): void {
    const sorted = [...collections].sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
    this.collections.set(sorted);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      void chrome.storage.local.set({ [STORAGE_KEY]: sorted });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    }
  }

  private load(): void {
    const apply = (value: unknown): void => {
      const collections = Array.isArray(value)
        ? value.filter(item => this.isSmartCollection(item)).map(item => ({ ...item }))
        : [];
      this.collections.set(collections.sort((left, right) => left.name.localeCompare(right.name)));
      this.ready.set(true);
      this.resolveReady();
    };
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([STORAGE_KEY], result => apply(result[STORAGE_KEY]));
      return;
    }
    try {
      apply(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'));
    } catch {
      apply([]);
    }
  }

  private createId(): string {
    return globalThis.crypto?.randomUUID?.()
      ?? `smart-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
