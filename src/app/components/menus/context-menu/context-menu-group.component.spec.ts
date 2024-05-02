import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContextMenuGroupComponent } from './context-menu-group.component';

describe('ContextMenuGroupComponent', () => {
  let component: ContextMenuGroupComponent;
  let fixture: ComponentFixture<ContextMenuGroupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ ContextMenuGroupComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContextMenuGroupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
