import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookmarkMenuComponent } from './bookmark-menu.component';

describe('BookmarkMenuComponent', () => {
  let component: BookmarkMenuComponent;
  let fixture: ComponentFixture<BookmarkMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ BookmarkMenuComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BookmarkMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
