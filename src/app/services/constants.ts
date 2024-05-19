/**
 * Enumeration of valid drop locations relative to an element. These are
 * bit masks to allow combining multiple locations in a single value.
 */
export enum DropPosition {
  NONE = 0,
  ABOVE = 1,
  ON = 2,
  BELOW = 4,
}

/**
 * Where the menu was opened from. Values must never be renumbered or reused.
 */
export enum MenuSource {
  NONE = 0,
  ITEM = 1,
  TREE = 2,
  TOOLBAR = 3,
  LIST = 4,

  // Append new values to the end of the enum.
  NUM_VALUES = 5,
}

/**
 * Mirrors the C++ enum from IncognitoModePrefs.
 */
export enum IncognitoAvailability {
  ENABLED = 0,
  DISABLED = 1,
  FORCED = 2,
}

export const LOCAL_STORAGE_FOLDER_STATE_KEY: string = 'folderOpenState';

export const LOCAL_STORAGE_TREE_WIDTH_KEY: string = 'treeWidth';

export const ROOT_NODE_ID: string = '0';

export const BOOKMARKS_BAR_ID: string = '1';

export const OPEN_CONFIRMATION_LIMIT: number = 15;

/**
 * Folders that are beneath this depth will be closed by default in the folder
 * tree (where the Bookmarks Bar folder is at depth 0).
 */
export const FOLDER_OPEN_BY_DEFAULT_DEPTH: number = 1;
