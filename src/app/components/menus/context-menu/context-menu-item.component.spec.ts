import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContextMenuItemComponent } from './context-menu-item.component';
import { ContextMenuGroupDirective } from './context-menu-group.component';

@Component({
  standalone: true,
  imports: [ContextMenuItemComponent, ContextMenuGroupDirective],
  template: `
    <app-context-menu-item label="Parent">
      <app-context-menu-group></app-context-menu-group>
    </app-context-menu-item>
  `
})
class ContextMenuItemHost {
  @ViewChild(ContextMenuItemComponent) item!: ContextMenuItemComponent;
}

describe('ContextMenuItemComponent', () => {
  let fixture: ComponentFixture<ContextMenuItemHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContextMenuItemHost]
    }).compileComponents();

    fixture = TestBed.createComponent(ContextMenuItemHost);
    fixture.detectChanges();
  });

  it('reports nested menu groups', () => {
    expect(fixture.componentInstance.item.label).toBe('Parent');
    expect(fixture.componentInstance.item.hasChildren).toBe(true);
  });
});
