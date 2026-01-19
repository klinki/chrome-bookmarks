import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContextMenuGroupDirective } from './context-menu-group.component';
import { ContextMenuItemComponent } from './context-menu-item.component';
import { QueryList } from '@angular/core';

describe.skip('ContextMenuGroupDirective', () => {
  let component: ContextMenuGroupDirective;
  let fixture: ComponentFixture<ContextMenuGroupDirective>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ ContextMenuGroupDirective, ContextMenuItemComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContextMenuGroupDirective);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
