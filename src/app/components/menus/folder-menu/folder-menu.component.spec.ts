import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FolderMenuComponent } from './folder-menu.component';

describe('FolderMenuComponent', () => {
  let component: FolderMenuComponent;
  let fixture: ComponentFixture<FolderMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ FolderMenuComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FolderMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
