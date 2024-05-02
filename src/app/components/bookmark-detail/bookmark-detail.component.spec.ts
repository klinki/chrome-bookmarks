import { ComponentFixture, TestBed } from '@angular/core/testing';
import {BookmarkDetailComponent} from "./bookmark-detail.component";

describe('BookmarkDetailComponent', () => {
  let component: BookmarkDetailComponent;
  let fixture: ComponentFixture<BookmarkDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ BookmarkDetailComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BookmarkDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
