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
    mockSelectionService.selectedDirectory.set(null);
    mockSelectionService.selectDirectory.mockReset();
    mockSelectionService.expandDirectories.mockReset();
    mockSelectionService.isDirectoryExpanded.mockReset().mockReturnValue(false);
    mockSelectionService.toggleDirectory.mockReset();
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
    const directory = {
      id: '123',
      parentId: '1',
      title: 'Empty Folder',
      children: []
    } as any;
    fixture.componentRef.setInput('directories', [directory]);
    mockSelectionService.selectedDirectory.set(directory);
    fixture.detectChanges();

    const deleteSpy = vi.spyOn((component as any).rightClickMenu, 'deleteSelectedFolder').mockResolvedValue(undefined);
    const treeItem: HTMLDivElement = fixture.nativeElement.querySelector('[role="treeitem"]');
    treeItem.focus();

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

  it('renders a labelled tree with one initial tab stop', () => {
    fixture.componentRef.setInput('directories', [{
      id: 'parent',
      title: 'Parent',
      children: [{ id: 'child', title: 'Child', children: [] }]
    }]);
    fixture.detectChanges();

    const tree = fixture.nativeElement.querySelector('[role="tree"]');
    const items = fixture.nativeElement.querySelectorAll('[role="treeitem"]');

    expect(tree.getAttribute('aria-label')).toBe('Bookmark folders');
    expect(items[0].getAttribute('tabindex')).toBe('0');
    expect(items[1].getAttribute('tabindex')).toBe('-1');
  });

  it('moves selection through visible folders with ArrowDown', () => {
    const child = { id: 'child', title: 'Child', children: [] };
    fixture.componentRef.setInput('directories', [{
      id: 'parent',
      title: 'Parent',
      children: [child]
    }]);
    mockSelectionService.isDirectoryExpanded.mockImplementation((id: string) => id === 'parent');
    fixture.detectChanges();
    const parentItem = fixture.nativeElement.querySelector('[data-tree-id="parent"]');
    const event = {
      key: 'ArrowDown',
      target: parentItem,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    } as unknown as KeyboardEvent;

    component.onTreeKeydown(event);

    expect(mockSelectionService.selectDirectory).toHaveBeenCalledWith(child);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('expands a collapsed folder with ArrowRight', () => {
    fixture.componentRef.setInput('directories', [{
      id: 'parent',
      title: 'Parent',
      children: [{ id: 'child', title: 'Child', children: [] }]
    }]);
    fixture.detectChanges();
    const parentItem = fixture.nativeElement.querySelector('[data-tree-id="parent"]');
    const event = {
      key: 'ArrowRight',
      target: parentItem,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    } as unknown as KeyboardEvent;

    component.onTreeKeydown(event);

    expect(mockSelectionService.toggleDirectory).toHaveBeenCalledWith('parent');
  });
});
