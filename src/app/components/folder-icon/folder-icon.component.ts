import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  standalone: true,
  selector: 'app-folder-icon',
  imports: [MatIconModule],
  template: `<mat-icon class="tree-icon" [fontIcon]="icon()"></mat-icon>`,
  styleUrls: ['./folder-icon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FolderIconComponent {
  public item = input.required<any>();
  public expanded = input<boolean>(false);

  public icon = computed(() => {
    const directory = this.item();
    const isExpanded = this.expanded();

    if (directory.id?.startsWith('TAG_') || directory.id === 'ROOT_TAGS') {
      return 'label';
    }
    if (directory.id?.startsWith('SERVER_') || directory.id === 'ROOT_SERVERS') {
      return 'dns';
    }
    if (directory.id === 'ROOT_ALL') {
      return 'bookmarks';
    }

    return isExpanded ? 'folder_open' : 'folder';
  });
}
