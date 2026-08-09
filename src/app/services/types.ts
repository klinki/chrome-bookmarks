import { DropPosition } from './constants';

// A normalized version of chrome.bookmarks.BookmarkTreeNode.
export interface BookmarkNode {
  id: string;
  title: string;
  parentId?: string;
  url?: string;
  dateAdded?: number;
  dateLastUsed?: number;
  dateGroupModified?: number;
  unmodifiable?: string;
  children?: string[];
}

export interface ObjectMap<Type> {
  [index: string]: Type;
}

export type NodeMap = ObjectMap<BookmarkNode>;


export interface DropDestination {
  element: BookmarkElement;
  position: DropPosition;
}

export type BookmarkElement = Element;


export interface DragData {
  elements: chrome.bookmarks.BookmarkTreeNode[];
  sameProfile: boolean;
}

export type TimerProxy = Pick<Window, 'setTimeout'|'clearTimeout'>;
