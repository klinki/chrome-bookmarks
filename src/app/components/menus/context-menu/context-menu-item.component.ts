import {ContentChildren, Directive, EventEmitter, Input, OnInit, Output, QueryList} from '@angular/core';
import {ContextMenuGroupDirective} from "./context-menu-group.component";

@Directive({
  selector: 'app-context-menu-item',
  standalone: true
})
export class ContextMenuItemComponent implements OnInit {
  @Input()
  label: string = '';

  @Input()
  enabled: boolean|null = true;

  @Input()
  hidden: boolean|null = false;

  @Input()
  icon?: string|null;

  @Input()
  toggled?: boolean|null = false;

  @Input()
  iconColor: string|null = null;

  @ContentChildren(ContextMenuGroupDirective)
  menuGroups!: QueryList<ContextMenuGroupDirective>;

  @Output()
  activate = new EventEmitter();

  get hasChildren() {
    return this.menuGroups?.toArray()?.length > 0;
  }

  constructor() { }

  ngOnInit(): void {
  }
}
