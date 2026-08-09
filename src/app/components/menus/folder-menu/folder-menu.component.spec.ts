import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FolderMenuComponent } from './folder-menu.component';

import { BookmarksService } from '../../../services/chrome/bookmarks/bookmarks.service';
import { SelectionService } from '../../../services/selection.service';
import { Router } from '@angular/router';

describe('FolderMenuComponent', () => {
  let component: FolderMenuComponent;
  let fixture: ComponentFixture<FolderMenuComponent>;
  let confirmSpy: ReturnType<typeof vi.spyOn>;
  let alertSpy: ReturnType<typeof vi.spyOn>;

  const mockBookmarksService = {
    get: vi.fn(),
    remove: vi.fn().mockResolvedValue(undefined),
    create: vi.fn()
  };

  const mockSelectionService = {
    clearDirectorySelection: vi.fn(),
    selectDirectory: vi.fn()
  };

  const mockRouter = {
    navigate: vi.fn()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ FolderMenuComponent ],
      providers: [
        { provide: BookmarksService, useValue: mockBookmarksService },
        { provide: SelectionService, useValue: mockSelectionService },
        { provide: Router, useValue: mockRouter }
      ]
    })
    .compileComponents();

    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockBookmarksService.get.mockReset();
    mockBookmarksService.remove.mockReset();
    mockSelectionService.clearDirectorySelection.mockReset();
    mockSelectionService.selectDirectory.mockReset();
    mockBookmarksService.get.mockResolvedValue([]);

    fixture = TestBed.createComponent(FolderMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('deletes an empty folder after confirmation', async () => {
    const parentFolder = {
      id: '1',
      title: 'Parent',
      children: []
    };

    mockBookmarksService.get.mockResolvedValue([parentFolder]);
    component.folder = {
      id: '123',
      parentId: '1',
      title: 'Empty Folder',
      children: []
    };

    await component.deleteSelectedFolder();

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete "Empty Folder"?');
    expect(mockBookmarksService.get).toHaveBeenCalledWith('1');
    expect(mockBookmarksService.remove).toHaveBeenCalledWith('123');
    expect(mockSelectionService.selectDirectory).toHaveBeenCalledWith(parentFolder);
    expect(mockSelectionService.clearDirectorySelection).not.toHaveBeenCalled();
  });

  it('refuses to delete non-empty folders', async () => {
    component.folder = {
      id: '123',
      parentId: '1',
      title: 'Not Empty',
      children: [{ id: 'child', title: 'Child' }]
    };

    await component.deleteSelectedFolder();

    expect(alertSpy).toHaveBeenCalledWith('Only empty folders can be deleted from the sidebar.');
    expect(mockBookmarksService.remove).not.toHaveBeenCalled();
  });

  it('clears directory selection when parent cannot be resolved', async () => {
    component.folder = {
      id: '123',
      parentId: 'missing',
      title: 'Empty Folder',
      children: []
    };

    await component.deleteSelectedFolder();

    expect(mockBookmarksService.get).toHaveBeenCalledWith('missing');
    expect(mockSelectionService.selectDirectory).not.toHaveBeenCalled();
    expect(mockSelectionService.clearDirectorySelection).toHaveBeenCalledTimes(1);
  });
});
