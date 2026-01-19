import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { vi } from 'vitest';
import { TreeViewComponent } from './tree-view.component';
import { BookmarksService } from '../../services/chrome/bookmarks/bookmarks.service';
import { MockBookmarksService } from '../../services/chrome/bookmarks/mock-bookmarks.service';
import { BookmarksFacadeService } from '../../services/bookmarks-facade.service';
import { SelectionService } from '../../services/selection.service';
import { DragAndDropService } from '../../services/drag-and-drop.service';
import { signal } from '@angular/core';

describe('Component: TreeView', () => {
  let component: TreeViewComponent;
  let fixture: ComponentFixture<TreeViewComponent>;

  const mockBookmarksFacade = {
    directories: signal([]),
    items: signal([])
  };

  const mockSelectionService = {
    selectedDirectory: signal(null),
    selectDirectory: vi.fn()
  };
  
  const mockDragAndDropService = {};

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [TreeViewComponent],
      providers: [
        { provide: BookmarksFacadeService, useValue: mockBookmarksFacade },
        { provide: SelectionService, useValue: mockSelectionService },
        { provide: DragAndDropService, useValue: mockDragAndDropService },
        { provide: BookmarksService, useClass: MockBookmarksService }
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TreeViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create an instance', () => {
    expect(component).toBeTruthy();
  });
});
