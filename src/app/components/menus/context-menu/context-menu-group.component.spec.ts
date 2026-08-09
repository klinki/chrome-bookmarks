import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContextMenuGroupDirective } from './context-menu-group.component';
import { ContextMenuItemComponent } from './context-menu-item.component';

@Component({
  standalone: true,
  imports: [ContextMenuGroupDirective, ContextMenuItemComponent],
  template: `
    <app-context-menu-group>
      <app-context-menu-item label="Visible"></app-context-menu-item>
      <app-context-menu-item label="Hidden" [hidden]="true"></app-context-menu-item>
    </app-context-menu-group>
  `
})
class ContextMenuGroupHost {
  @ViewChild(ContextMenuGroupDirective) group!: ContextMenuGroupDirective;
}

describe('ContextMenuGroupDirective', () => {
  let fixture: ComponentFixture<ContextMenuGroupHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContextMenuGroupHost]
    }).compileComponents();

    fixture = TestBed.createComponent(ContextMenuGroupHost);
    fixture.detectChanges();
  });

  it('exposes only visible menu items', () => {
    expect(fixture.componentInstance.group.visibleMenuItems.map(item => item.label))
      .toEqual(['Visible']);
  });
});
