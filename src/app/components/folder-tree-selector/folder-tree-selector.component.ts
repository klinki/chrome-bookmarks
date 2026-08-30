import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';

export interface FolderTreeNode {
  id: string;
  title: string;
  children: FolderTreeNode[];
}

interface VisibleFolder {
  node: FolderTreeNode;
  level: number;
}

@Component({
  selector: 'app-folder-tree-selector',
  standalone: true,
  templateUrl: './folder-tree-selector.component.html',
  styleUrl: './folder-tree-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FolderTreeSelectorComponent implements OnChanges {
  @Input() public folders: FolderTreeNode[] = [];
  @Input() public selectedIds: ReadonlySet<string> = new Set<string>();
  @Input() public featureLabel = 'feature';
  @Output() public selectionChange = new EventEmitter<ReadonlySet<string>>();

  public readonly expandedIds = signal<ReadonlySet<string>>(new Set());
  private initialized = false;

  public ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized && changes['folders'] && this.folders.length > 0) {
      this.expandedIds.set(new Set(
        this.folders.filter(folder => folder.children.length > 0).map(folder => folder.id)
      ));
      this.initialized = true;
    }
  }

  public visibleFolders(): VisibleFolder[] {
    const visible: VisibleFolder[] = [];
    const expanded = this.expandedIds();
    const visit = (folders: FolderTreeNode[], level: number): void => {
      folders.forEach(folder => {
        visible.push({ node: folder, level });
        if (expanded.has(folder.id)) {
          visit(folder.children, level + 1);
        }
      });
    };
    visit(this.folders, 0);
    return visible;
  }

  public hasChildren(folder: FolderTreeNode): boolean {
    return folder.children.length > 0;
  }

  public isExpanded(folderId: string): boolean {
    return this.expandedIds().has(folderId);
  }

  public isSelected(folderId: string): boolean {
    return this.selectedIds.has(folderId);
  }

  public toggleExpanded(event: MouseEvent, folderId: string): void {
    event.stopPropagation();
    const next = new Set(this.expandedIds());
    if (next.has(folderId)) {
      next.delete(folderId);
    } else {
      next.add(folderId);
    }
    this.expandedIds.set(next);
  }

  public toggleSelected(event: Event, folderId: string): void {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.selectedIds);
    if (checked) {
      next.add(folderId);
    } else {
      next.delete(folderId);
    }
    this.selectionChange.emit(next);
  }
}
