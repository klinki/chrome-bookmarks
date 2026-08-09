import { ROOT_NODE_ID } from './constants';
import type { NodeMap } from './types';

/**
 * Returns true if the node with ID `itemId` is modifiable.
 * Top-level roots and managed nodes cannot be moved or deleted.
 */
export function canEditNode(
  nodes: Record<string, chrome.bookmarks.BookmarkTreeNode>,
  itemId: string
): boolean {
  const currentNode = nodes[itemId];

  return itemId !== ROOT_NODE_ID
    && currentNode != null
    && currentNode.parentId !== ROOT_NODE_ID
    && !currentNode.unmodifiable;
}

/**
 * Returns true if children can be reordered or added under `itemId`.
 */
export function canReorderChildren(
  nodes: Record<string, chrome.bookmarks.BookmarkTreeNode>,
  itemId?: string
): boolean {
  return itemId != null
    && itemId !== ROOT_NODE_ID
    && nodes[itemId] != null
    && !nodes[itemId].unmodifiable;
}

export function hasChildFolders(
  id: string,
  nodes: NodeMap | Record<string, chrome.bookmarks.BookmarkTreeNode>
): boolean {
  const children = nodes[id]?.children ?? [];

  return children.some(child => {
    if (typeof child === 'string') {
      return Boolean((nodes as NodeMap)[child]?.children?.length);
    }

    return Boolean(child.children?.length);
  });
}
