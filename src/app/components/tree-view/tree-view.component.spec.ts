import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { TreeViewComponent } from './tree-view.component';
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
    selectDirectory: jasmine.createSpy('selectDirectory')
  };
  
  const mockDragAndDropService = {};

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [TreeViewComponent],
      providers: [
        { provide: BookmarksFacadeService, useValue: mockBookmarksFacade },
        { provide: SelectionService, useValue: mockSelectionService },
        { provide: DragAndDropService, useValue: mockDragAndDropService }
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
