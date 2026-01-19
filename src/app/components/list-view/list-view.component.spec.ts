import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { vi } from 'vitest';
import { ListViewComponent } from './list-view.component';
import { SelectionService } from '../../services/selection.service';
import { BookmarksFacadeService } from '../../services/bookmarks-facade.service';
import { TagsService } from '../../services/tags.service';
import { BookmarksService } from '../../services/chrome/bookmarks/bookmarks.service';
import { MockBookmarksService } from '../../services/chrome/bookmarks/mock-bookmarks.service';
import { signal } from '@angular/core';

describe('Component: ListView', () => {
  let component: ListViewComponent;
  let fixture: ComponentFixture<ListViewComponent>;

  const mockSelectionService = {
    selection: signal(new Set()),
    selectAllActive: signal(false),
    select: vi.fn(),
    clearSelection: vi.fn(),
    selectAll: vi.fn(),
    items: [],
    itemsSignal: signal([]) 
  };

  const mockBookmarksFacade = {
    items: signal([])
  };

  const mockTagsService = {};

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ListViewComponent],
      providers: [
        { provide: SelectionService, useValue: mockSelectionService },
        { provide: BookmarksFacadeService, useValue: mockBookmarksFacade },
        { provide: TagsService, useValue: mockTagsService },
        { provide: BookmarksService, useClass: MockBookmarksService }
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create an instance', () => {
    expect(component).toBeTruthy();
  });
});
