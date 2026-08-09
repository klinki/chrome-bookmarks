import { Component, OnInit, input, inject, effect, ElementRef, HostListener, ViewChild } from '@angular/core';
import { SelectionService } from '../../services';
import { TreeItemComponent } from "./tree-item.component";
import { FolderMenuComponent } from "../menus/folder-menu/folder-menu.component";

export type BookmarkDirectory = any;

@Component({
  standalone: true,
  selector: 'app-tree-view',
  templateUrl: './tree-view.component.html',
  styleUrls: ['./tree-view.component.scss'],
  imports: [
    TreeItemComponent,
    FolderMenuComponent
  ]
})
export class TreeViewComponent implements OnInit {
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

  ngOnInit() {
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

  toggle(directory: BookmarkDirectory) {
    if (directory.children.length === 0)
      return;

    directory.expanded = !directory.expanded;
  }

  expanded(directory: BookmarkDirectory) {
    return directory.expanded;
  }

  isVisible(directory: BookmarkDirectory) {
    return directory && !directory.url;
  }

  open(directory: BookmarkDirectory) {
    this.selectionService.selectDirectory(directory);
  }

  public focusTree() {
    this.treeContainer.nativeElement.focus();
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
