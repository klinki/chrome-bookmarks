import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookmarksProviderService } from '../../../services/bookmarks-provider.service';
import { CleanupSettingsService } from '../../../services/cleanup-settings.service';

interface FolderOption {
  id: string;
  path: string;
}

@Component({
  selector: 'app-organize-cleanup-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './organize-cleanup-settings.component.html',
  styleUrl: './organize-cleanup-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrganizeCleanupSettingsComponent implements OnInit {
  private readonly provider = inject(BookmarksProviderService);
  private readonly settingsService = inject(CleanupSettingsService);

  public readonly folders = signal<FolderOption[]>([]);
  public readonly selectedFolderId = signal('');
  public readonly loading = signal(true);
  public readonly error = signal('');
  public readonly excludedFolders = computed(() => {
    const excludedIds = new Set(this.settingsService.settings().excludedFolderIds ?? []);
    return this.folders().filter(folder => excludedIds.has(folder.id));
  });
  public readonly availableFolders = computed(() => {
    const excludedIds = new Set(this.settingsService.settings().excludedFolderIds ?? []);
    return this.folders().filter(folder => !excludedIds.has(folder.id));
  });

  public ngOnInit(): void {
    void this.loadFolders();
  }

  public addExcludedFolder(): void {
    const folderId = this.selectedFolderId();
    if (!folderId || this.settingsService.settings().excludedFolderIds?.includes(folderId)) {
      return;
    }
    this.settingsService.update({
      excludedFolderIds: [...(this.settingsService.settings().excludedFolderIds ?? []), folderId]
    });
    this.selectedFolderId.set('');
  }

  public removeExcludedFolder(folderId: string): void {
    this.settingsService.update({
      excludedFolderIds: (this.settingsService.settings().excludedFolderIds ?? [])
        .filter(id => id !== folderId)
    });
  }

  private async loadFolders(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const tree = await this.provider.getBookmarks();
      const folders: FolderOption[] = [];
      const visit = (node: chrome.bookmarks.BookmarkTreeNode, parents: string[]): void => {
        if (node.url) {
          return;
        }
        const path = [...parents, node.title];
        if (node.parentId !== undefined) {
          folders.push({ id: node.id, path: path.join(' / ') });
        }
        node.children?.forEach(child => visit(child, path));
      };
      tree.forEach(root => root.children?.forEach(child => visit(child, [])));
      this.folders.set(folders.sort((left, right) => left.path.localeCompare(right.path)));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Folders could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
}
