import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TreeItemComponent } from './tree-item.component';
import { SelectionService } from '../../services';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('TreeItemComponent', () => {
  let component: TreeItemComponent;
  let fixture: ComponentFixture<TreeItemComponent>;

  const mockSelectionService = {
    selectedDirectory: signal(null),
    selectDirectory: vi.fn(),
    isDirectoryExpanded: vi.fn().mockReturnValue(false),
    toggleDirectory: vi.fn()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeItemComponent],
      providers: [
        { provide: SelectionService, useValue: mockSelectionService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TreeItemComponent);
    component = fixture.componentInstance;
    // Set a dummy directory input to avoid errors
    fixture.componentRef.setInput('directory', { id: '1', title: 'Root', children: [] });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('hasSubDirectories', () => {
    it('should return false if children is empty', () => {
      const directory = { id: '1', title: 'Folder', children: [] } as any;
      expect(component.hasSubDirectories(directory)).toBe(false);
    });

    it('should return false if directory is null', () => {
        expect(component.hasSubDirectories(null as any)).toBe(false);
    });

    it('should return true if ALL children are folders (have children property)', () => {
      const directory = {
        id: '1',
        title: 'Folder',
        children: [
          { id: '2', title: 'Sub1', children: [] },
          { id: '3', title: 'Sub2', children: [] }
        ]
      } as any;
      expect(component.hasSubDirectories(directory)).toBe(true);
    });

    it('should return true if ANY child IS a folder (mixed content)', () => {
      const directory = {
        id: '1',
        title: 'Folder',
        children: [
          { id: '2', title: 'Sub1', children: [] },
          { id: '3', title: 'Bookmark1' } // No children property
        ]
      } as any;
      expect(component.hasSubDirectories(directory)).toBe(true);
    });

    it('should return false if NO child is a folder', () => {
        const directory = {
          id: '1',
          title: 'Folder',
          children: [
            { id: '2', title: 'Bookmark1' }, // No children property
            { id: '3', title: 'Bookmark2' } // No children property
          ]
        } as any;
        expect(component.hasSubDirectories(directory)).toBe(false);
      });
  });

  it('stores expansion by directory ID instead of mutating the input node', () => {
    const directory = { id: 'folder', title: 'Folder', children: [{ id: 'child', children: [] }] } as any;
    const event = { stopPropagation: vi.fn() } as any;

    component.toggle(event, directory);

    expect(mockSelectionService.toggleDirectory).toHaveBeenCalledWith('folder');
    expect(directory.expanded).toBeUndefined();
  });
});
