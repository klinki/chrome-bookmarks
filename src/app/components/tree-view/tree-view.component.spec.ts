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
    selectDirectory: vi.fn(),
    expandDirectories: vi.fn(),
    isDirectoryExpanded: vi.fn().mockReturnValue(false),
    toggleDirectory: vi.fn()
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

  it('expands the selected directory path by stable IDs', () => {
    fixture.componentRef.setInput('directories', [{
      id: 'parent',
      title: 'Parent',
      children: [{ id: 'child', title: 'Child', children: [] }]
    }]);
    mockSelectionService.selectedDirectory.set({ id: 'child', title: 'Child' } as any);

    fixture.detectChanges();

    expect(mockSelectionService.expandDirectories).toHaveBeenCalledWith(['parent', 'child']);
  });

  it('forwards Delete to folder deletion when the tree has focus', () => {
    mockSelectionService.selectedDirectory.set({
      id: '123',
      parentId: '1',
      title: 'Empty Folder',
      children: []
    } as any);
    fixture.detectChanges();

    const deleteSpy = vi.spyOn((component as any).rightClickMenu, 'deleteSelectedFolder').mockResolvedValue(undefined);
    const treeContainer: HTMLDivElement = fixture.nativeElement.querySelector('#tree-container');
    treeContainer.focus();

    const event = {
      key: 'Delete',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      target: { localName: 'body' }
    } as any;

    component.onKeydown(event);

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });
});
