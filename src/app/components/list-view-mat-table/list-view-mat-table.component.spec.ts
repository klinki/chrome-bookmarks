import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListViewMatTableComponent } from './list-view-mat-table.component';

describe('ListViewMatTableComponent', () => {
  let component: ListViewMatTableComponent;
  let fixture: ComponentFixture<ListViewMatTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ ListViewMatTableComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListViewMatTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
