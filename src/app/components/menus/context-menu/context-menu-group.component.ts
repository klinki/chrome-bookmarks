import {ContentChildren, Directive, forwardRef, OnInit, QueryList} from '@angular/core';
import {ContextMenuItemComponent} from "./context-menu-item.component";

@Directive({
  selector: 'app-context-menu-group',
  standalone: true
})
export class ContextMenuGroupDirective implements OnInit {
  @ContentChildren(forwardRef(() => ContextMenuItemComponent))
  groupItems!: QueryList<ContextMenuItemComponent>;

  get visibleMenuItems(): ContextMenuItemComponent[] {
    return this.groupItems?.toArray()?.filter(item => !item.hidden) ?? [];
  }

  constructor() { }

  ngOnInit(): void {
  }
}
