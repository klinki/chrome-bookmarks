import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookmarksProviderService } from '../../../services/bookmarks-provider.service';
import { CleanupSettingsService } from '../../../services/cleanup-settings.service';
import { FolderTreeNode, FolderTreeSelectorComponent } from '../../folder-tree-selector/folder-tree-selector.component';

@Component({
  selector: 'app-organize-cleanup-settings',
  standalone: true,
  imports: [CommonModule, FolderTreeSelectorComponent],
  templateUrl: './organize-cleanup-settings.component.html',
  styleUrl: './organize-cleanup-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrganizeCleanupSettingsComponent implements OnInit {
  private readonly provider = inject(BookmarksProviderService);
  private readonly settingsService = inject(CleanupSettingsService);

  public readonly folders = signal<FolderTreeNode[]>([]);
  public readonly loading = signal(true);
  public readonly error = signal('');
  public readonly cleanupExcludedFolderIds = computed(() =>
    new Set(this.settingsService.settings().cleanupExcludedFolderIds));
  public readonly organizeExcludedFolderIds = computed(() =>
    new Set(this.settingsService.settings().organizeExcludedFolderIds));

  public ngOnInit(): void {
    void this.loadFolders();
  }

  public updateCleanupExclusions(ids: ReadonlySet<string>): void {
    this.settingsService.update({ cleanupExcludedFolderIds: [...ids] });
  }

  public updateOrganizeExclusions(ids: ReadonlySet<string>): void {
    this.settingsService.update({ organizeExcludedFolderIds: [...ids] });
  }

  private async loadFolders(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const tree = await this.provider.getBookmarks();
      const toFolder = (node: chrome.bookmarks.BookmarkTreeNode): FolderTreeNode => ({
        id: node.id,
        title: node.title,
        children: (node.children ?? [])
          .filter(child => child.url === undefined)
          .map(child => toFolder(child))
      });
      const folders: FolderTreeNode[] = [];
      const visit = (node: chrome.bookmarks.BookmarkTreeNode): void => {
        if (node.url) {
          return;
        }
        if (node.parentId !== undefined) {
          folders.push(toFolder(node));
        }
      };
      tree.forEach(root => root.children?.forEach(child => visit(child)));
      this.folders.set(folders);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Folders could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
}
