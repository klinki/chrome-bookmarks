import {ChangeDetectorRef, Component, Inject, Input, SimpleChanges, ViewChild} from '@angular/core';
import { CommonModule } from '@angular/common';
import {ContextMenuComponent} from "../context-menu/context-menu.component";
import {ContextMenuGroupDirective} from "../context-menu/context-menu-group.component";
import {ContextMenuItemComponent} from "../context-menu/context-menu-item.component";
import { Icons } from 'src/app/shared/icons';
import {Router} from "@angular/router";

@Component({
  selector: 'app-folder-menu',
  standalone: true,
  imports: [CommonModule, ContextMenuComponent, ContextMenuGroupDirective, ContextMenuItemComponent],
  templateUrl: './folder-menu.component.html',
  styleUrl: './folder-menu.component.scss'
})
export class FolderMenuComponent {
  Icons = Icons;

  @Input()
  folder!: any|null;

  @ViewChild('menu', { static: true })
  menu!: ContextMenuComponent;

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router
) { }

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

    const urlTree = this.router.createUrlTree(['conversation-detail'], {
      queryParams: {
        conversationId: 1
      },
    });

    const url = this.router.serializeUrl(urlTree);
    return `/#` + url;
  }
}
