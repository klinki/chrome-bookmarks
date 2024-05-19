import {BOOKMARKS_BAR_ID, IncognitoAvailability, ROOT_NODE_ID} from './constants';
import type {BookmarkNode, BookmarksPageState, NodeMap, ObjectMap} from './types';

/**
 * @fileoverview Utility functions for the Bookmarks page.
 */

export function getDisplayedList(state: BookmarksPageState): string[] {
  if (isShowingSearch(state)) {
    return state.search.results ?? [];
  }

  const children = state.nodes[state.selectedFolder]!.children;
  return children ?? [];
}

export function normalizeNode(treeNode: chrome.bookmarks.BookmarkTreeNode): BookmarkNode {
  const node = Object.assign({}, treeNode);
  // Node index is not necessary and not kept up-to-date. Remove it from the
  // data structure so we don't accidentally depend on the incorrect
  // information.
  delete node.index;
  delete node.children;
  const bookmarkNode = node as unknown as BookmarkNode;

  if (!('url' in node)) {
    // The onCreated API listener returns folders without |children| defined.
    bookmarkNode.children = (treeNode.children || []).map(function(child) {
      return child.id;
    });
  }
  return bookmarkNode;
}

export function normalizeNodes(rootNode: chrome.bookmarks.BookmarkTreeNode):
  NodeMap {
  const nodeMap: NodeMap = {};
  const stack = [];
  stack.push(rootNode);

  while (stack.length > 0) {
    const node = stack.pop()!;
    nodeMap[node.id] = normalizeNode(node);
    if (!node.children) {
      continue;
    }

    node.children.forEach(function(child) {
      stack.push(child);
    });
  }

  return nodeMap;
}

export function createEmptyState(): BookmarksPageState {
  return {
    nodes: {},
    selectedFolder: BOOKMARKS_BAR_ID,
    folderOpenState: new Map(),
    prefs: {
      canEdit: true,
      incognitoAvailability: IncognitoAvailability.ENABLED,
    },
    search: {
      term: '',
      inProgress: false,
      results: null,
    },
    selection: {
      items: new Set(),
      anchor: null,
    },
  };
}

export function isShowingSearch(state: Partial<BookmarksPageState>): boolean {
  return (state?.search?.results?.length ?? 0) > 0;
}

/**
 * Returns true if the node with ID |itemId| is modifiable, allowing
 * the node to be renamed, moved or deleted. Note that if a node is
 * uneditable, it may still have editable children
 * (for example, the top-level folders).
 */
export function canEditNode(nodes: Record<string, chrome.bookmarks.BookmarkTreeNode>, itemId: string, state?: BookmarksPageState): boolean {
  const currentNode = nodes[itemId];

  return itemId !== ROOT_NODE_ID &&
    currentNode != null &&
    currentNode!.parentId !== ROOT_NODE_ID  &&
    !currentNode!.unmodifiable &&
    (state?.prefs.canEdit ?? true);
}

/**
 * Returns true if it is possible to modify the children list of the node with
 * ID |itemId|. This includes rearranging the children or adding new ones.
 */
export function canReorderChildren(nodes: Record<string, chrome.bookmarks.BookmarkTreeNode>, itemId?: string, state?: BookmarksPageState): boolean {
  return itemId != null
    && itemId !== ROOT_NODE_ID
    && !nodes[itemId]!.unmodifiable
    && (state?.prefs.canEdit ?? true)
}

export function hasChildFolders(id: string, nodes: NodeMap|Record<string, chrome.bookmarks.BookmarkTreeNode>): boolean {
  const nodesAsMap = nodes as NodeMap;
  const nodeAsRecord = nodes as Record<string, chrome.bookmarks.BookmarkTreeNode>;
  const children = nodes[id]!.children ?? [];

  return children.some(node => {
    if (typeof node === 'string') {
      return nodesAsMap[node].children != null && nodesAsMap[node].children!.length > 0;
    }

    return node.children != null && node.children.length > 0;
  });
}

export function getDescendants(nodes: NodeMap, baseId: string): Set<string> {
  const descendants = new Set<string>();
  const stack: string[] = [];
  stack.push(baseId);

  while (stack.length > 0) {
    const id = stack.pop()!;
    const node = nodes[id];

    if (!node) {
      continue;
    }

    descendants.add(id);

    if (!node!.children) {
      continue;
    }

    node!.children.forEach(function(childId) {
      stack.push(childId);
    });
  }

  return descendants;
}

export function removeIdsFromObject<Type>(map: ObjectMap<Type>, ids: Set<string>): ObjectMap<Type> {
  const newObject = Object.assign({}, map);
  ids.forEach(function(id) {
    delete newObject[id];
  });

  return newObject;
}


export function removeIdsFromMap<Type>(map: Map<string, Type>, ids: Set<string>): Map<string, Type> {
  const newMap = new Map(map);
  ids.forEach(function(id) {
    newMap.delete(id);
  });

  return newMap;
}

export function removeIdsFromSet(set: Set<string>, ids: Set<string>): Set<string> {
  const newSet = new Set(set);
  ids.forEach(function(id) {
    newSet.delete(id);
  });

  return newSet;
}
