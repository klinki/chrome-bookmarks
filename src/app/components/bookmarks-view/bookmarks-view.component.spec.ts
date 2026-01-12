import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { BookmarksViewComponent } from './bookmarks-view.component';
import { BookmarksFacadeService } from '../../services/bookmarks-facade.service';
import { DragAndDropService } from '../../services/drag-and-drop.service';
import { SelectionService } from '../../services/selection.service';
import { AiService } from '../../services/ai.service';
import { TagsService } from '../../services/tags.service';
import { ReactiveFormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

xdescribe('Component: BookmarksView', () => {
  let component: BookmarksViewComponent;
  let fixture: ComponentFixture<BookmarksViewComponent>;

  const mockBookmarksFacade = {
    selectedBookmarkIds: signal(new Set()),
    directories: signal([]),
    items: signal([]),
    selectedBookmarks: signal([])
  };

  const mockDragAndDropService = {
    init: jasmine.createSpy('init')
  };


  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [BookmarksViewComponent, NoopAnimationsModule, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        { provide: BookmarksFacadeService, useValue: mockBookmarksFacade },
        { provide: DragAndDropService, useValue: mockDragAndDropService },
        { provide: SelectionService, useValue: {} },
        { provide: AiService, useValue: { suggestTags: jasmine.createSpy('suggestTags') } },
        { provide: TagsService, useValue: { getTagsForBookmark: () => [], availableTags: signal([]) } }
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BookmarksViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create an instance', () => {
    expect(component).toBeTruthy();
  });
});
