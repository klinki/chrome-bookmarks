import { Component, OnInit, Input } from '@angular/core';
import { SelectionService } from '../../services';
import {TreeItemComponent} from "./tree-item.component";
import {AsyncPipe, NgForOf} from "@angular/common";
import {FolderMenuComponent} from "../menus/folder-menu/folder-menu.component";

export type BookmarkDirectory = any;

@Component({
  standalone: true,
  selector: 'app-tree-view',
  templateUrl: './tree-view.component.html',
  styleUrls: ['./tree-view.component.scss'],
  imports: [
    TreeItemComponent,
    NgForOf,
    AsyncPipe,
    FolderMenuComponent
  ]
})
export class TreeViewComponent implements OnInit {
  @Input() directories: BookmarkDirectory[]|null = [];

  selectedDirectory$ = this.selectionService.selectedDirectory$;

  constructor(private selectionService: SelectionService) {
  }

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
