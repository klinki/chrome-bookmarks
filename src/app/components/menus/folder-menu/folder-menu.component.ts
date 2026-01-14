import { ChangeDetectorRef, Component, inject, Input, SimpleChanges, ViewChild } from '@angular/core';

import { ContextMenuComponent } from "../context-menu/context-menu.component";
import { ContextMenuGroupDirective } from "../context-menu/context-menu-group.component";
import { ContextMenuItemComponent } from "../context-menu/context-menu-item.component";
import { Icons } from 'src/app/shared/icons';
import { Router } from "@angular/router";

@Component({
  selector: 'app-folder-menu',
  standalone: true,
  imports: [ContextMenuComponent, ContextMenuGroupDirective, ContextMenuItemComponent],
  templateUrl: './folder-menu.component.html',
  styleUrl: './folder-menu.component.scss'
})
export class FolderMenuComponent {
  Icons = Icons;

  @Input() public folder: any | null = null;

  @ViewChild('menu', { static: true })
  menu!: ContextMenuComponent;

  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  ngOnInit(): void {
    console.log(this.folder);
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.cdr.detectChanges(); // this is needed to re-render deeply nested menu items
  }

  openInNewTab() {
    window.open(this.getUrl(), "_blank");
  }

  openInNewWindow() {
    // TODO more parameters
    const popupHeight = Math.max(parseInt((window.innerHeight * 0.8) as any /*this is to round it up to a whole number*/), 500);
    // TODO check if window height > width
    const popupWidth = Math.max(Math.min(parseInt((popupHeight * 1.777) as any /*this is to round it up to a whole number*/), window.innerWidth * 0.8), 500);
    // TODO position
    window.open(this.getUrl(), "_blank", `toolbar=yes,scrollbars=yes,resizable=yes,top=500,left=500,width=${popupWidth},height=${popupHeight}`);
  }

  createNewFolder() {

  }

  createNewBookmark() {

  }

  private getUrl() {
    return this.folder?.url;
  }
}
