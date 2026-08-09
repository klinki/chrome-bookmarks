import { ComponentFixture, TestBed } from '@angular/core/testing';
import { type MockInstance, vi } from 'vitest';
import { FolderMenuComponent } from './folder-menu.component';

import { BookmarksService } from '../../../services/chrome/bookmarks/bookmarks.service';
import { SelectionService } from '../../../services/selection.service';
import { Router } from '@angular/router';

describe('FolderMenuComponent', () => {
  let component: FolderMenuComponent;
  let fixture: ComponentFixture<FolderMenuComponent>;
  let confirmSpy: MockInstance;
  let alertSpy: MockInstance;
  let promptSpy: MockInstance;

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
    promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockBookmarksService.get.mockReset();
    mockBookmarksService.remove.mockReset();
    mockBookmarksService.create.mockReset();
    mockBookmarksService.create.mockResolvedValue(undefined);
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
    promptSpy.mockRestore();
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
  it('reports folder creation failures', async () => {
    promptSpy.mockReturnValueOnce('New folder');
    mockBookmarksService.create.mockRejectedValueOnce(new Error('Create failed'));
    component.folder = { id: '1', title: 'Parent', children: [] };

    await component.createNewFolder();

    expect(mockBookmarksService.create).toHaveBeenCalledWith({
      parentId: '1',
      title: 'New folder'
    });
    expect(alertSpy).toHaveBeenCalledWith('Failed to create folder.');
  });

  it('reports bookmark creation failures', async () => {
    promptSpy
      .mockReturnValueOnce('New bookmark')
      .mockReturnValueOnce('https://example.com');
    mockBookmarksService.create.mockRejectedValueOnce(new Error('Create failed'));
    component.folder = { id: '1', title: 'Parent', children: [] };

    await component.createNewBookmark();

    expect(mockBookmarksService.create).toHaveBeenCalledWith({
      parentId: '1',
      title: 'New bookmark',
      url: 'https://example.com'
    });
    expect(alertSpy).toHaveBeenCalledWith('Failed to create bookmark.');
  });

  it('reports folder deletion failures without changing selection', async () => {
    mockBookmarksService.get.mockResolvedValue([{ id: '1', title: 'Parent', children: [] }]);
    mockBookmarksService.remove.mockRejectedValueOnce(new Error('Remove failed'));
    component.folder = {
      id: '123',
      parentId: '1',
      title: 'Empty Folder',
      children: []
    };

    await component.deleteSelectedFolder();

    expect(alertSpy).toHaveBeenCalledWith('Failed to delete folder.');
    expect(mockSelectionService.selectDirectory).not.toHaveBeenCalled();
    expect(mockSelectionService.clearDirectorySelection).not.toHaveBeenCalled();
  });

});
