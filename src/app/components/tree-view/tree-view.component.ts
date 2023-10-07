import { Component, OnInit, Input } from '@angular/core';
import { SelectionService } from '../../services';
import {TreeItemComponent} from "./tree-item.component";
import {NgForOf} from "@angular/common";

export type BookmarkDirectory = any;

@Component({
  standalone: true,
  selector: 'app-tree-view',
  templateUrl: 'tree-view.component.html',
  styleUrls: ['tree-view.component.css'],
  imports: [
    TreeItemComponent,
    NgForOf
  ]
})
export class TreeViewComponent implements OnInit {
  @Input() directories: BookmarkDirectory[]|null = [];

  constructor(private bookmarkService: SelectionService) {
  }

  ngOnInit() {
  }

  toggle(directory: BookmarkDirectory) {
    directory.expanded = !directory.expanded;
  }

  expanded(directory: BookmarkDirectory) {
    return directory.expanded;
  }

  isVisible(directory: BookmarkDirectory) {
    return directory && !directory.url;
  }

  open(directory: BookmarkDirectory) {
    this.bookmarkService.selectDirectory(directory);
  }
}
