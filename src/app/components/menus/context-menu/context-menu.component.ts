import {AfterContentInit, Component, ContentChildren, Input, OnInit, QueryList, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {CdkMenu, CdkMenuItem, CdkMenuTrigger} from "@angular/cdk/menu";
import { ContextMenuGroupDirective } from './context-menu-group.component';
import { Icons } from '../../../shared/icons';

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [CommonModule, CdkMenuItem, CdkMenuTrigger, CdkMenu],
  templateUrl: './context-menu.component.html',
  styleUrl: './context-menu.component.scss'
})
export class ContextMenuComponent implements OnInit, AfterContentInit {
  Icons = Icons;

  @ContentChildren(ContextMenuGroupDirective)
  menuGroups!: QueryList<ContextMenuGroupDirective>;

  @Input()
  menuGroupsInput?: ContextMenuGroupDirective[];

  @Input()
  menuClasses: string[] = [];

  @Input()
  menuStyles: object = {};

  @ViewChild('menu', { static: true })
  menu!: TemplateRef<any>;

  @ViewChild('cdkMenu')
  cdkMenu!: CdkMenu;

  constructor() { }

  ngOnInit(): void {
  }

  ngAfterContentInit() {
    // contentChildren is set
    if (this.menuGroupsInput == null) {
      this.menuGroupsInput = this.menuGroups?.toArray() ?? [];
    }
  }
}

