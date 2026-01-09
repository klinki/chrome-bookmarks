import { Component, OnInit, input, inject } from '@angular/core';
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

  public directories = input<BookmarkDirectory[] | null>([]);

  public selectedDirectory = this.selectionService.selectedDirectory;

  ngOnInit() {
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
}
