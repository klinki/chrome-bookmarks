import { Component } from '@angular/core';

import {CdkMenu, CdkMenuItem, CdkMenuTrigger} from "@angular/cdk/menu";
import {ContextMenuComponent} from "../context-menu/context-menu.component";
import {ContextMenuGroupDirective} from "../context-menu/context-menu-group.component";
import {ContextMenuItemComponent} from "../context-menu/context-menu-item.component";
import {Icons} from "../../../shared/icons";

@Component({
  selector: 'app-bookmark-menu',
  standalone: true,
  imports: [CdkMenu, CdkMenuItem, CdkMenuTrigger, ContextMenuComponent, ContextMenuGroupDirective, ContextMenuItemComponent],
  templateUrl: './bookmark-menu.component.html',
  styleUrl: './bookmark-menu.component.css'
})
export class BookmarkMenuComponent {
  Icons = Icons;

  openInNewTab() {

  }

  openInNewWindow() {

  }
}
