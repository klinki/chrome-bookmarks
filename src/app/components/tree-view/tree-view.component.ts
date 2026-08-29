import { Component, input, inject, effect, ElementRef, HostListener, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { SelectionService } from '../../services';
import { TreeItemComponent } from "./tree-item.component";
import { FolderMenuComponent } from "../menus/folder-menu/folder-menu.component";

export type BookmarkDirectory = any;

@Component({
  standalone: true,
  selector: 'app-tree-view',
  templateUrl: './tree-view.component.html',
  styleUrls: ['./tree-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    TreeItemComponent,
    FolderMenuComponent
  ]
})
export class TreeViewComponent {
  private selectionService = inject(SelectionService);
  @ViewChild('treeContainer', { static: true }) private treeContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('rightClickMenu', { static: true }) private rightClickMenu!: FolderMenuComponent;

  public directories = input<BookmarkDirectory[] | null>([]);

  public selectedDirectory = this.selectionService.selectedDirectory;

  constructor() {
    effect(() => {
      const selectedDir = this.selectedDirectory();
      const directories = this.directories();

      if (selectedDir && directories) {
        const path = this.findDirectoryPath(directories, selectedDir.id);
        if (path) {
          this.selectionService.expandDirectories(path);
        }
      }
    });
  }


  private findDirectoryPath(nodes: BookmarkDirectory[], targetId: string): string[] | null {
    for (const node of nodes) {
      if (node.id === targetId) {
        return [node.id];
      }

      if (node.children?.length) {
        const childPath = this.findDirectoryPath(node.children, targetId);
        if (childPath) {
          return [node.id, ...childPath];
        }
      }
    }

    return null;
  }

  public focusTree(event?: FocusEvent) {
    const container = this.treeContainer.nativeElement;
    if (event && event.target !== container) {
      return;
    }

    const visibleDirectories = this.getVisibleDirectories();
    const target = this.selectedDirectory() ?? visibleDirectories[0];
    if (!target) {
      return;
    }

    if (!this.selectedDirectory()) {
      this.selectionService.selectDirectory(target);
    }
    this.focusDirectory(target.id);
  }

  public onTreeKeydown(event: KeyboardEvent): void {
    const handledKeys = new Set(['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'Enter', ' ', 'Spacebar']);
    if (!handledKeys.has(event.key)) {
      return;
    }

    const visibleDirectories = this.getVisibleDirectories();
    if (visibleDirectories.length === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const focusedId = (event.target as HTMLElement)
      .closest<HTMLElement>('[role="treeitem"]')
      ?.dataset['treeId'];
    const selectedId = this.selectedDirectory()?.id;
    let index = visibleDirectories.findIndex(directory => directory.id === (focusedId ?? selectedId));
    if (index < 0) {
      index = 0;
    }

    const current = visibleDirectories[index];
    let target = current;

    switch (event.key) {
      case 'ArrowDown':
        target = visibleDirectories[Math.min(index + 1, visibleDirectories.length - 1)];
        break;
      case 'ArrowUp':
        target = visibleDirectories[Math.max(index - 1, 0)];
        break;
      case 'Home':
        target = visibleDirectories[0];
        break;
      case 'End':
        target = visibleDirectories[visibleDirectories.length - 1];
        break;
      case 'ArrowRight': {
        const children = this.getFolderChildren(current);
        if (children.length === 0) {
          break;
        }
        if (!this.selectionService.isDirectoryExpanded(current.id)) {
          this.selectionService.toggleDirectory(current.id);
        } else {
          target = children[0];
        }
        break;
      }
      case 'ArrowLeft': {
        if (this.selectionService.isDirectoryExpanded(current.id)) {
          this.selectionService.toggleDirectory(current.id);
        } else {
          target = this.findParentDirectory(this.directories() ?? [], current.id) ?? current;
        }
        break;
      }
    }

    this.selectionService.selectDirectory(target);
    this.focusDirectory(target.id);
  }

  private getVisibleDirectories(): BookmarkDirectory[] {
    const visible: BookmarkDirectory[] = [];
    const visit = (directories: BookmarkDirectory[]) => {
      for (const directory of directories) {
        visible.push(directory);
        if (this.selectionService.isDirectoryExpanded(directory.id)) {
          visit(this.getFolderChildren(directory));
        }
      }
    };

    visit(this.directories() ?? []);
    return visible;
  }

  private getFolderChildren(directory: BookmarkDirectory): BookmarkDirectory[] {
    return (directory.children ?? []).filter((child: BookmarkDirectory) => !child.url);
  }

  private findParentDirectory(
    directories: BookmarkDirectory[],
    targetId: string,
    parent: BookmarkDirectory | null = null
  ): BookmarkDirectory | null {
    for (const directory of directories) {
      if (directory.id === targetId) {
        return parent;
      }

      const found = this.findParentDirectory(
        this.getFolderChildren(directory),
        targetId,
        directory
      );
      if (found) {
        return found;
      }
    }

    return null;
  }

  private focusDirectory(directoryId: string): void {
    queueMicrotask(() => {
      const item = Array.from(
        this.treeContainer.nativeElement.querySelectorAll<HTMLElement>('[role="treeitem"]')
      ).find(element => element.dataset['treeId'] === directoryId);
      item?.focus();
    });
  }

  @HostListener('window:keydown', ['$event'])
  public onKeydown(event: KeyboardEvent) {
    if ((event.target as HTMLElement).localName === 'input') {
      return true;
    }

    if (event.key === 'Delete' && this.treeHasFocus()) {
      event.preventDefault();
      event.stopPropagation();
      void this.rightClickMenu.deleteSelectedFolder();
      return false;
    }

    return true;
  }

  private treeHasFocus() {
    const container = this.treeContainer.nativeElement;
    return document.activeElement === container || container.contains(document.activeElement);
  }
}
