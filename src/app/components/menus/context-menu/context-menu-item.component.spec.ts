import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContextMenuItemComponent } from './context-menu-item.component';
import { ContextMenuGroupDirective } from './context-menu-group.component';

describe.skip('ContextMenuItemComponent', () => {
  let component: ContextMenuItemComponent;
  let fixture: ComponentFixture<ContextMenuItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ ContextMenuItemComponent, ContextMenuGroupDirective ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContextMenuItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
