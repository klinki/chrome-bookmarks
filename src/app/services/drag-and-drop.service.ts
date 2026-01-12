import {DestroyRef, inject, Injectable} from '@angular/core';
import {fromEvent, tap} from "rxjs";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {BookmarkElement, DragData, DropDestination, NodeMap, ObjectMap, TimerProxy} from "./types";
import {canEditNode, canReorderChildren, hasChildFolders, isShowingSearch, normalizeNode} from "./util";
import {DropPosition, ROOT_NODE_ID} from "./constants";
import {injectDisplayedItems, injectSelection} from "./bookmarks-facade.service";
import {injectSelectedFolderSignal, injectSelectItemCallback} from "./selection.service";
import {injectAllBookmarksMap, injectMoveMultipleBookmarksCallback} from "./bookmarks-provider.service";
import {Debouncer} from "../utils/debouncer";
import {TagsService} from "./tags.service";

interface NormalizedDragData {
  elements: chrome.bookmarks.BookmarkTreeNode[];
  sameProfile: boolean;
}

type BookmarksFolderNodeElement = any;

@Injectable()
export class DragAndDropService {

  private readonly destroy: DestroyRef = inject(DestroyRef);
  private dropDestination: any|null = null;
  private dragInfo = new DragInfo();
  private dropIndicator = new DropIndicator();
  private autoExpander = new AutoExpander();

  private timerProxy: TimerProxy = window;

  selectedItems = injectSelection();
  displayedItems = injectDisplayedItems();
  selectedFolder = injectSelectedFolderSignal();
  bookmarksMap = injectAllBookmarksMap();

  selectItemCallback = injectSelectItemCallback();
  moveMultipleCallback = injectMoveMultipleBookmarksCallback();

  private tagsService = inject(TagsService);

  constructor() {
    fromEvent<Event>(document, 'dragstart').pipe(
      tap(event => console.log(event)),
      tap(event => this.onDragStart(event)),
      takeUntilDestroyed(this.destroy)
    ).subscribe();

    fromEvent<Event>(document, 'dragenter').pipe(
      // tap(event => console.log(event)),
      tap(event => this.onDragEnter(event)),
      takeUntilDestroyed(this.destroy)
    ).subscribe();

    fromEvent<Event>(document, 'dragover').pipe(
      tap(event => console.log(event)),
      tap(event => this.onDragOver(event)),
      takeUntilDestroyed(this.destroy)
    ).subscribe();

    fromEvent<Event>(document, 'dragleave').pipe(
      // tap(event => console.log(event)),
      tap(event => this.onDragLeave(event)),
      takeUntilDestroyed(this.destroy)
    ).subscribe();

    fromEvent<Event>(document, 'drop').pipe(
      tap(event => console.log(event)),
      tap(event => this.onDrop(event)),
      takeUntilDestroyed(this.destroy)
    ).subscribe();

    fromEvent<Event>(document, 'dragend').pipe(
      tap(event => console.log(event)),
      tap(event => this.onDragEnd(event)),
      takeUntilDestroyed(this.destroy)
    ).subscribe();
  }

  public init() { }

  getBookmarkElement(path?: EventTarget[]): BookmarkElement | null {
    if (path == null) {
      return null;
    }

    const result = path.find(target => {
      const element = target as Element;
      return (isBookmarkItem(element) || isBookmarkFolderNode(element) || isBookmarkList(element));
    }) as BookmarkElement;

    return result ?? null;
  }

  getDragElement(path: EventTarget[]): BookmarkElement | null {
    if (path.some(target => (target as Element).tagName === 'BUTTON')) {
      return null;
    }

    const dragElement = this.getBookmarkElement(path);
    return dragElement != null && dragElement.getAttribute('draggable')
      ? dragElement
      : null;
  }

  private onDragStart(e: Event) {
    const dragElement = this.getDragElement(e.composedPath());
    if (dragElement == null) {
      return;
    }

    // e.preventDefault();

    const dragData = this.calculateDragData(dragElement);
    if (dragData == null) {
      this.clearDragData();
      return;
    }

    let dragNodeIds = [] as string[];
    let dragNodes = [] as chrome.bookmarks.BookmarkTreeNode[];

    // TODO: What is this?
    if (isBookmarkItem(dragElement)) {
      const displayingItems = this.displayedItems().map(x => x.id);
      // TODO(crbug.com/41468833): Make this search more time efficient to avoid
      // delay on large amount of bookmark dragging.
      for (const itemId of displayingItems) {
        for (const element of dragData.elements) {
          if (element!.id === itemId) {
            dragNodeIds.push(element!.id);
            dragNodes.push(element);
            break;
          }
        }
      }
    } else {
      dragNodeIds = dragData.elements.map((item) => item!.id);
      dragNodes = dragData.elements;
    }

    // assert(dragNodeIds.length === dragData.elements.length);
    const itemId = dragElement?.attributes?.getNamedItem('itemid')?.value ?? '';
    const dragNodeIndex = dragNodeIds.indexOf(itemId);
    // assert(dragNodeIndex !== -1);

    this.dragInfo.setNativeDragData({
      elements: dragNodes,
      sameProfile: true
    });

    // BookmarkManagerApiProxyImpl.getInstance().startDrag(
    //   dragNodeIds, dragNodeIndex, this.lastPointerWasTouch_,
    //   (e as DragEvent).clientX, (e as DragEvent).clientY);
  }

  private onDragLeave(e: Event) {
    this.dropIndicator!.finish();
  }

  private async onDrop(e: Event) {
    // Allow normal DND on text inputs.
    if (isTextInputElement(e.composedPath()[0] as HTMLElement)) {
      return;
    }

    e.preventDefault();

    if (this.dropDestination) {
      const dropInfo = this.calculateDropInfo(this.dropDestination);
      const index = dropInfo.index !== -1 ? dropInfo.index : undefined;
      const shouldHighlight = shouldHighlightDest(this.dropDestination);

      if (shouldHighlight) {
        // TODO:
        // trackUpdatedItems();
      }

      const dropIds = this.dragInfo.dragData?.elements.map((x: chrome.bookmarks.BookmarkTreeNode) => x.id) ?? [];

      // Handle dropping on Tag
      if (dropInfo.parentId.startsWith('TAG_')) {
        const tagName = dropInfo.parentId.replace('TAG_', '');
        dropIds.forEach(id => {
          this.tagsService.addTagToBookmark(id, tagName);
        });
        // Do not move bookmarks
      } else {
        await this.moveMultipleCallback(dropIds, {
          parentId: dropInfo.parentId,
          index: index
        });
      }

      // BookmarkManagerApiProxyImpl.getInstance()
      //   .drop(dropInfo.parentId, index)
      //   .then(shouldHighlight ? highlightUpdatedItems : undefined);
    }

    this.clearDragData();
  }

  private onDragEnter(e: Event) {
    e.preventDefault();
  }

  private onDragOver(e: Event) {
    try {
      this.dropDestination = null;

      // Allow normal DND on text inputs.
      if (isTextInputElement(e.composedPath()[0] as HTMLElement)) {
        return;
      }

      // The default operation is to allow dropping links etc to do
      // navigation. We never want to do that for the bookmark manager.
      e.preventDefault();

      if (!this.dragInfo!.isDragValid()) {
        return;
      }

      const overElement = this.getBookmarkElement(e.composedPath());
      if (!overElement) {
        this.autoExpander!.update(e, overElement);
        this.dropIndicator!.finish();
        return;
      }

      // Now we know that we can drop. Determine if we will drop above, on or
      // below based on mouse position etc.
      this.dropDestination = this.calculateDropDestination((e as DragEvent).clientY, overElement);
      if (!this.dropDestination) {
        this.autoExpander!.update(e, overElement);
        this.dropIndicator!.finish();
        return;
      }

      this.autoExpander!.update(e, overElement, this.dropDestination.position);
      this.dropIndicator!.update(this.dropDestination);
    } catch (err) {
      console.error('onDragOver error', err);
    }
  }

  private onDragEnd(e: Event) {
    this.clearDragData();
  }

  private clearDragData() {
    this.autoExpander!.reset();

    // Defer the clearing of the data so that the bookmark manager API's drop
    // event doesn't clear the drop data before the web drop event has a
    // chance to execute (on Mac).
    this.timerProxy.setTimeout(() => {
      this.dragInfo!.clearDragData();
      this.dropDestination = null;
      this.dropIndicator!.finish();
    }, 0);
  }

  private calculateDropInfo(dropDestination: DropDestination): { parentId: string, index: number } {
    if (isBookmarkList(dropDestination.element)) {
      return {
        index: 0,
        parentId: this.selectedFolder()?.id!,
      };
    }

    const node = this.getBookmarkNode(dropDestination.element);

    // Virtual Nodes handling
    if (node.id.startsWith('TAG_')) {
      return {
        index: -1,
        parentId: node.id
      };
    }

    const position = dropDestination.position;
    let index = -1;
    let parentId = node.id;

    if (position !== DropPosition.ON) {
      const nodesMap = this.bookmarksMap();

      // Drops between items in the normal list and the sidebar use the drop
      // destination node's parent.
      // assert(node.parentId);
      parentId = node.parentId!;
      index = nodesMap[parentId]!.children!.findIndex(x => x.id == node.id);

      if (position === DropPosition.BELOW) {
        index++;
      }
    }

    return {
      index: index,
      parentId: parentId,
    };
  }

  /**
   * Calculates which items should be dragged based on the initial drag item
   * and the current selection. Dragged items will end up selected.
   */
  private calculateDragData(dragElement: BookmarkElement): DragData | null {
    const dragId = dragElement?.attributes?.getNamedItem('itemid')?.value;

    if (dragId == null) {
      return null;
    }

    // Determine the selected bookmarks.
    let draggedNodes: chrome.bookmarks.BookmarkTreeNode[] = this.selectedItems();
    let draggedNodeIds = this.selectedItems().map(x => x.id);

    // Change selection to the dragged node if the node is not part of the existing selection.
    if (isBookmarkFolderNode(dragElement) || draggedNodeIds.indexOf(dragId) === -1) {
      const allNodeMap = this.bookmarksMap();
      const draggedBookmarkNode = allNodeMap[dragId];

      if (!isBookmarkFolderNode(dragElement)) {
        this.selectItemCallback(draggedBookmarkNode);
      }

      draggedNodeIds = [dragId];
      draggedNodes = [draggedBookmarkNode];
    }

    // If any node can't be dragged, end the drag.
    const anyUnmodifiable = draggedNodeIds.some((itemId) => !canEditNode(this.bookmarksMap(), itemId));

    if (anyUnmodifiable) {
      return null;
    }

    return {
      elements: draggedNodes,
      sameProfile: true,
    };
  }

  /**
   * This function determines where the drop will occur.
   */
  private calculateDropDestination(elementClientY: number, overElement: BookmarkElement): DropDestination | null {
    const validDropPositions = this.calculateValidDropPositions(overElement);
    if (validDropPositions === DropPosition.NONE) {
      return null;
    }

    const above = validDropPositions & DropPosition.ABOVE;
    const below = validDropPositions & DropPosition.BELOW;
    const on = validDropPositions & DropPosition.ON;
    const rect = overElement.getBoundingClientRect();
    const yRatio = (elementClientY - rect.top) / rect.height;

    if (above && (yRatio <= .25 || yRatio <= .5 && (!below || !on))) {
      return { element: overElement, position: DropPosition.ABOVE };
    }

    if (below && (yRatio > .75 || yRatio > .5 && (!above || !on))) {
      return { element: overElement, position: DropPosition.BELOW };
    }

    if (on) {
      return { element: overElement, position: DropPosition.ON };
    }

    return null;
  }

  /**
   * Determines the valid drop positions for the given target element.
   */
  private calculateValidDropPositions(overElement: BookmarkElement): number {
    const dragInfo = this.dragInfo!;
    const nodesMap = this.bookmarksMap();
    let itemId = overElement?.attributes?.getNamedItem('itemid')?.value;

    if (itemId == null) {
      console.error('null');
      return DropPosition.NONE;
    }

    // Drags aren't allowed onto the search result list.
    if ((isBookmarkList(overElement) || isBookmarkItem(overElement)) &&
      isShowingSearch({ search: { results: [], term: '', inProgress: false } })) {
      return DropPosition.NONE;
    }

    if (isBookmarkList(overElement)) {
      itemId = this.selectedFolder()!.id;
    }

    // Virtual Node Check for Tags
    if (itemId.startsWith('TAG_')) {
      // Can only drop ON tags. Cannot reorder tags (yet).
      // Only allow dropping bookmarks, not folders, onto tags.
      if (dragInfo.isDraggingFolders()) {
        return DropPosition.NONE;
      }
      return DropPosition.ON;
    }

    // Virtual Node Check for Roots and Servers
    if (itemId === 'ROOT_ALL' || itemId === 'ROOT_TAGS' || itemId.startsWith('SERVER_')) {
      return DropPosition.NONE;
    }

    if (!nodesMap[itemId]) {
        return DropPosition.NONE;
    }

    if (!canReorderChildren(nodesMap, itemId)) {
      return DropPosition.NONE;
    }

    // Drags of a bookmark onto itself or of a folder into its children aren't allowed.
    if (dragInfo.isDraggingBookmark(itemId) || dragInfo.isDraggingFolderToDescendant(itemId, nodesMap as any)) {
      return DropPosition.NONE;
    }

    let validDropPositions = this.calculateDropAboveBelow(overElement);
    if (this.canDropOn(overElement)) {
      validDropPositions |= DropPosition.ON;
    }

    return validDropPositions;
  }

  private calculateDropAboveBelow(overElement: BookmarkElement): number {
    const overElementItemId = overElement?.attributes?.getNamedItem('itemid')?.value

    const dragInfo = this.dragInfo!;
    const nodesMap = this.bookmarksMap();

    if (isBookmarkList(overElement)) {
      return DropPosition.NONE;
    }

    // We cannot drop between Bookmarks bar and Other bookmarks.
    if (this.getBookmarkNode(overElement).parentId === ROOT_NODE_ID) {
      return DropPosition.NONE;
    }

    // Virtual Node Check - cannot sort tags or root nodes or servers
    if (overElementItemId?.startsWith('TAG_') || overElementItemId?.startsWith('ROOT_') || overElementItemId?.startsWith('SERVER_')) {
      return DropPosition.NONE;
    }

    const isOverFolderNode = isBookmarkFolderNode(overElement);

    // We can only drop between items in the tree if we have any folders.
    if (isOverFolderNode && !dragInfo.isDraggingFolders()) {
      return DropPosition.NONE;
    }

    let validDropPositions = DropPosition.NONE;

    // Cannot drop above if the item above is already in the drag source.
    const previousElem = overElement.previousElementSibling as BookmarksFolderNodeElement;
    const previousElemItemId = previousElem?.attributes.getNamedItem('itemid').value
    if (!previousElem || !dragInfo.isDraggingBookmark(previousElemItemId)) {
      validDropPositions |= DropPosition.ABOVE;
    }

    // Don't allow dropping below an expanded sidebar folder item since it is
    // confusing to the user anyway.
    if (isOverFolderNode && !isClosedBookmarkFolderNode(overElement)
      && overElementItemId != null && hasChildFolders(overElementItemId, nodesMap)) {
      return validDropPositions;
    }

    const nextElement = overElement.nextElementSibling as BookmarksFolderNodeElement;
    const nextElementItemId = nextElement?.attributes.getNamedItem('itemid').value
    // Cannot drop below if the item below is already in the drag source.
    if (!nextElement || !dragInfo.isDraggingBookmark(nextElementItemId)) {
      validDropPositions |= DropPosition.BELOW;
    }

    return validDropPositions;
  }

  /**
   * Determine whether we can drop the dragged items on the drop target.
   */
  private canDropOn(overElement: BookmarkElement): boolean {
    const overElementItemId = overElement?.attributes?.getNamedItem('itemid')?.value

    // Allow dragging onto empty bookmark lists.
    if (isBookmarkList(overElement)) {
      const selectedFolder = this.selectedFolder();
      const nodesMap = this.bookmarksMap()!;
      return selectedFolder != null
        && nodesMap[selectedFolder.id]!.children!.length === 0;
    }

    const node = this.getBookmarkNode(overElement);

    // Support virtual Tag folders
    if (node.id.startsWith('TAG_')) {
      return true;
    }

    // We can only drop on a folder.
    if (node.url) {
      return false;
    }

    if (overElementItemId == null) {
      console.error('invalid overElementItemId');
      return false;
    }

    return !this.dragInfo!.isDraggingChildBookmark(overElementItemId);
  }

  getBookmarkNode(bookmarkElement: BookmarkElement) {
    const itemId = bookmarkElement?.attributes?.getNamedItem('itemid')?.value!;

    if (itemId == null) {
      console.error('Unexpected null value');
    }

    // Virtual Node Mocking
    if (itemId.startsWith('TAG_')) {
      return {
        id: itemId,
        title: itemId.replace('TAG_', ''),
        children: [],
        // No parenId
      } as unknown as chrome.bookmarks.BookmarkTreeNode;
    }
    if (itemId === 'ROOT_ALL' || itemId === 'ROOT_TAGS') {
      return {
        id: itemId,
        title: itemId,
        children: [],
      } as unknown as chrome.bookmarks.BookmarkTreeNode;
    }

    const nodesMap = this.bookmarksMap()!;
    return nodesMap[itemId]!;
  }
}


function isBookmarkItem(element: Element): boolean {
  return element.tagName === 'BOOKMARKS-ITEM'
    || element.tagName === 'TR';
}

function isBookmarkFolderNode(element: Element): boolean {
  return element.tagName === 'APP-TREE-ITEM';
}

function isBookmarkList(element: Element): boolean {
  return element.tagName === 'BOOKMARKS-LIST';
}

function isTextInputElement(element: HTMLElement): boolean {
  return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';
}

function shouldHighlightDest(dropDestination: DropDestination): boolean {
  return isBookmarkItem(dropDestination.element) || isBookmarkList(dropDestination.element);
}

function isClosedBookmarkFolderNode(element: Element): boolean {
  const isClosed = false;
  // const isOpen = !((element as BookmarksFolderNodeElement).isOpen);
  return isBookmarkFolderNode(element) && isClosed;
}

/**
 * Contains and provides utility methods for drag data sent by the
 * bookmarkManagerPrivate API.
 */
export class DragInfo {
  dragData: NormalizedDragData | null = null;

  setNativeDragData(newDragData: DragData) {
    this.dragData = {
      sameProfile: newDragData.sameProfile,
      elements: newDragData.elements ?? [] // !.map((x) => normalizeNode(x)),
    };
  }

  clearDragData() {
    this.dragData = null;
  }

  isDragValid(): boolean {
    return this.dragData != null;
  }

  isSameProfile(): boolean {
    return this.isDragValid() && this.dragData!.sameProfile;
  }

  isDraggingFolders(): boolean {
    return this.isDragValid() && this.dragData!.elements.some(function (node) {
      return !node.url;
    });
  }

  isDraggingBookmark(bookmarkId: string): boolean {
    return this.isDragValid() && this.isSameProfile() &&
      this.dragData!.elements.some(function (node) {
        return node.id === bookmarkId;
      });
  }

  isDraggingChildBookmark(folderId: string): boolean {
    return this.isDragValid() && this.isSameProfile() &&
      this.dragData!.elements.some(function (node) {
        return node.parentId === folderId;
      });
  }

  isDraggingFolderToDescendant(itemId: string, nodes: NodeMap): boolean {
    if (!this.isSameProfile()) {
      return false;
    }

    let parentId = nodes[itemId]!.parentId;
    const parents: ObjectMap<boolean> = {};
    while (parentId) {
      parents[parentId] = true;
      parentId = nodes[parentId]!.parentId;
    }

    return this.isDragValid() && this.dragData!.elements.some(function (node) {
      return parents[node.id];
    });
  }
}


/**
 * Manages auto expanding of sidebar folders on hover while dragging.
 */
class AutoExpander {
  private lastElement: BookmarkElement | null = null;
  private debouncer: Debouncer;
  private lastX_: number | null = null;
  private lastY_: number | null = null;

  constructor() {
    this.debouncer = new Debouncer(() => {
      // const store = Store.getInstance();
      // store.dispatch(changeFolderOpen(this.lastElement!.itemId, true));
      this.reset();
    });
  }

  update(e: Event, overElement: BookmarkElement | null, dropPosition?: DropPosition) {
    const x = (e as DragEvent).clientX;
    const y = (e as DragEvent).clientY;
    const itemId = overElement?.attributes?.getNamedItem('itemid')?.value ?? null;
    // const store = Store.getInstance();

    // TODO:
    const nodeMap = {}; // store.data.nodes

    // If dragging over a new closed folder node with children reset the expander.
    // Falls through to reset the expander delay.
    if (overElement && overElement !== this.lastElement &&
      isClosedBookmarkFolderNode(overElement) &&
      hasChildFolders(itemId as string, nodeMap)
    ) {
      this.reset();
      this.lastElement = overElement;
    }

    // If dragging over the same node, reset the expander delay.
    if (overElement && overElement === this.lastElement &&
      dropPosition === DropPosition.ON) {
      if (x !== this.lastX_ || y !== this.lastY_) {
        this.debouncer.restartTimeout(folderOpenerTimeoutDelay);
      }
    } else {
      // Otherwise, cancel the expander.
      this.reset();
    }
    this.lastX_ = x;
    this.lastY_ = y;
  }

  reset() {
    this.debouncer.reset();
    this.lastElement = null;
  }
}

/**
 * Encapsulates the behavior of the drag and drop indicator which puts a line
 * between items or highlights folders which are valid drop targets.
 */
class DropIndicator {
  private removeDropIndicatorTimeoutId: number | null;
  private lastIndicatorElement: BookmarkElement | null;
  private lastIndicatorClassName: string | null;
  private timerProxy: TimerProxy;

  constructor() {
    this.removeDropIndicatorTimeoutId = null;
    this.lastIndicatorElement = null;
    this.lastIndicatorClassName = null;
    this.timerProxy = window;
  }

  /**
   * Applies the drop indicator style on the target element and stores that
   * information to easily remove the style in the future.
   */
  addDropIndicatorStyle(indicatorElement: Element, position: DropPosition) {
    const indicatorStyleName = position === DropPosition.ABOVE
      ? 'drag-above'
      : position === DropPosition.BELOW
        ? 'drag-below'
        : 'drag-on';

    this.lastIndicatorElement = indicatorElement as BookmarkElement;
    this.lastIndicatorClassName = indicatorStyleName;

    indicatorElement.classList.add(indicatorStyleName);
  }

  /**
   * Clears the drop indicator style from the last drop target.
   */
  removeDropIndicatorStyle() {
    if (this.lastIndicatorElement == null || this.lastIndicatorClassName == null) {
      return;
    }

    this.lastIndicatorElement.classList.remove(this.lastIndicatorClassName);
    this.lastIndicatorElement = null;
    this.lastIndicatorClassName = null;
  }

  /**
   * Displays the drop indicator on the current drop target to give the
   * user feedback on where the drop will occur.
   */
  update(dropDest: DropDestination) {
    this.timerProxy.clearTimeout(this.removeDropIndicatorTimeoutId!);
    this.removeDropIndicatorTimeoutId = null;

    const indicatorElement = dropDest.element; // .getDropTarget()!;
    const position = dropDest.position;

    this.removeDropIndicatorStyle();
    this.addDropIndicatorStyle(indicatorElement, position);
  }

  /**
   * Stop displaying the drop indicator.
   */
  finish() {
    if (this.removeDropIndicatorTimeoutId) {
      return;
    }

    // The use of a timeout is in order to reduce flickering as we move
    // between valid drop targets.
    this.removeDropIndicatorTimeoutId = this.timerProxy.setTimeout(() => {
      this.removeDropIndicatorStyle();
    }, 100);
  }
}


// Ms to wait during a dragover to open closed folder.
let folderOpenerTimeoutDelay = 400;
