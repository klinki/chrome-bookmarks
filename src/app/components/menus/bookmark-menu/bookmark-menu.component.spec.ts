import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookmarkMenuComponent } from './bookmark-menu.component';
import { BookmarksService } from '../../../services/chrome/bookmarks/bookmarks.service';
import { MockBookmarksService } from '../../../services/chrome/bookmarks/mock-bookmarks.service';

describe('BookmarkMenuComponent', () => {
  let component: BookmarkMenuComponent;
  let fixture: ComponentFixture<BookmarkMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ BookmarkMenuComponent ],
      providers: [
        { provide: BookmarksService, useClass: MockBookmarksService }
      ]
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
