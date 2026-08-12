import type { QuarantineRecord } from './cleanup.types';
import type { BookmarkTags } from './tags.service';
import type { BookmarkUsefulness } from './usefulness.service';
import type { SearchDocument } from './search.types';

export function createSearchDocuments(
  tree: readonly chrome.bookmarks.BookmarkTreeNode[],
  tags: Readonly<BookmarkTags>,
  usefulness: Readonly<BookmarkUsefulness>,
  quarantineRecords: Readonly<Record<string, QuarantineRecord>>
): SearchDocument[] {
  const documents: SearchDocument[] = [];
  for (const root of tree) {
    for (const child of root.children ?? []) {
      visit(child, [], [], false, documents, tags, usefulness, quarantineRecords);
    }
  }
  return documents;
}

function visit(
  node: chrome.bookmarks.BookmarkTreeNode,
  parentTitles: readonly string[],
  ancestorIds: readonly string[],
  insideCleanup: boolean,
  documents: SearchDocument[],
  tags: Readonly<BookmarkTags>,
  usefulness: Readonly<BookmarkUsefulness>,
  quarantineRecords: Readonly<Record<string, QuarantineRecord>>
): void {
  const type = node.url ? 'bookmark' : 'folder';
  const ownTitles = type === 'folder' && node.title ? [...parentTitles, node.title] : [...parentTitles];
  const isCleanupRoot = parentTitles[parentTitles.length - 1] === 'Trash' && node.title === 'Cleanup';
  const quarantined = insideCleanup || isCleanupRoot || Boolean(quarantineRecords[node.id]);
  let hostname = '';
  if (node.url) {
    try {
      hostname = new URL(node.url).hostname;
    } catch {
      // Invalid URLs remain searchable by title and their original URL text.
    }
  }
  const rating = usefulness[node.id];
  documents.push({
    id: node.id,
    type,
    title: node.title,
    url: node.url ?? '',
    hostname,
    tags: [...(tags[node.id] ?? [])],
    path: ownTitles.join(' / '),
    ancestorIds: [...ancestorIds],
    dateAdded: node.dateAdded,
    dateLastUsed: (node as chrome.bookmarks.BookmarkTreeNode & { dateLastUsed?: number }).dateLastUsed,
    usefulnessScore: rating?.score,
    usefulnessSource: rating?.source,
    quarantined
  });

  const childAncestorIds = [...ancestorIds, node.id];
  for (const child of node.children ?? []) {
    visit(
      child,
      ownTitles,
      childAncestorIds,
      quarantined,
      documents,
      tags,
      usefulness,
      quarantineRecords
    );
  }
}
