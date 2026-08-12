import { describe, expect, it } from 'vitest';
import { executeSearch } from './search-engine';
import { createSearchDocuments } from './search-documents';
import { parseSearchQuery } from './search-query';
import { SearchDocument } from './search.types';

const now = Date.UTC(2026, 0, 1);

const documents: SearchDocument[] = [
  {
    id: 'folder', type: 'folder', title: 'Références', url: '', hostname: '', tags: [],
    path: 'Work / Références', ancestorIds: ['root'], dateAdded: now - 400 * 86400000,
    quarantined: false
  },
  {
    id: 'one', type: 'bookmark', title: 'Angular Guide', url: 'https://angular.dev/guide',
    hostname: 'angular.dev', tags: ['TypeScript'], path: 'Work / Références',
    ancestorIds: ['root', 'folder'], dateAdded: now - 200 * 86400000,
    dateLastUsed: now - 40 * 86400000, usefulnessScore: 5, usefulnessSource: 'manual',
    quarantined: false
  },
  {
    id: 'unknown', type: 'bookmark', title: 'Old utility', url: 'https://tools.example',
    hostname: 'tools.example', tags: [], path: 'Archive', ancestorIds: ['root', 'archive'],
    dateAdded: now - 800 * 86400000, usefulnessScore: 2, usefulnessSource: 'ai', quarantined: false
  },
  {
    id: 'trash', type: 'bookmark', title: 'Angular duplicate', url: 'https://angular.dev/guide',
    hostname: 'angular.dev', tags: ['TypeScript'], path: 'Trash / Cleanup / Exact duplicates',
    ancestorIds: ['root', 'trash-folder'], dateAdded: now - 200 * 86400000,
    quarantined: true
  }
];

function ids(query: string, scope?: string): string[] {
  return executeSearch(documents, parseSearchQuery(query), scope, now);
}

describe('structured search engine', () => {
  it('searches all text fields with Unicode and case normalization', () => {
    expect(ids('references')).toEqual(['folder', 'one']);
    expect(ids('ANGULAR')).toEqual(['one']);
    expect(ids('tag:typescript host:angular.dev')).toEqual(['one']);
  });

  it('evaluates types, score provenance, dates, age, and unused durations', () => {
    expect(ids('type:bookmark score:>=4 source:manual')).toEqual(['one']);
    expect(ids('type:bookmark added:<2025-01-01')).toEqual(['unknown']);
    expect(ids('age:1y')).toEqual(['folder', 'unknown']);
    expect(ids('unused:30d')).toEqual(['one']);
    expect(ids('is:usage-unknown')).toEqual(['folder', 'unknown']);
  });

  it('treats ISO date equality and inclusive comparisons as whole calendar days', () => {
    const date = new Date(documents[1].dateAdded!).toISOString().slice(0, 10);

    expect(ids(`added:=${date}`)).toContain('one');
    expect(ids(`added:<=${date}`)).toContain('one');
    expect(ids(`added:>${date}`)).not.toContain('one');
  });

  it('handles missing metadata and state predicates', () => {
    expect(ids('is:untagged is:unrated')).toEqual(['folder']);
    expect(ids('NOT is:rated type:folder')).toEqual(['folder']);
    expect(ids('used:>=2020-01-01')).toEqual(['one']);
  });

  it('applies descendant-only folder scope', () => {
    expect(ids('', 'folder')).toEqual(['one']);
    expect(ids('', 'archive')).toEqual(['unknown']);
  });

  it('excludes quarantine by default and includes it only through a positive filter', () => {
    expect(ids('angular')).toEqual(['one']);
    expect(ids('angular OR is:quarantined')).toEqual(['one', 'trash']);
    expect(ids('NOT is:quarantined')).not.toContain('trash');
  });

  it('builds complete search documents for bookmarks and folders', () => {
    const built = createSearchDocuments([{
      id: '0', title: '', children: [{
        id: 'work', parentId: '0', title: 'Work', children: [{
          id: 'bookmark', parentId: 'work', title: 'Page', url: 'https://example.com/page',
          dateAdded: 10, dateLastUsed: 20
        }]
      }]
    }], { bookmark: ['Read'] }, { bookmark: { score: 4, source: 'ai' } }, {});

    expect(built).toEqual([
      expect.objectContaining({ id: 'work', type: 'folder', path: 'Work', ancestorIds: [] }),
      expect.objectContaining({
        id: 'bookmark', type: 'bookmark', path: 'Work', hostname: 'example.com',
        tags: ['Read'], usefulnessScore: 4, usefulnessSource: 'ai', ancestorIds: ['work']
      })
    ]);
  });

  it('keeps 50,000-document execution deterministic and ordered', () => {
    const large = Array.from({ length: 50_000 }, (_, index): SearchDocument => ({
      id: String(index), type: 'bookmark', title: `Bookmark ${index}`, url: `https://example.com/${index}`,
      hostname: 'example.com', tags: index % 100 === 0 ? ['needle'] : [], path: 'Benchmarks',
      ancestorIds: ['benchmarks'], quarantined: false
    }));

    const result = executeSearch(large, parseSearchQuery('tag:needle'), undefined, now);
    expect(result).toHaveLength(500);
    expect(result.slice(0, 3)).toEqual(['0', '100', '200']);
  });
});
