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
    remove: vi.fn().mockResolvedValue(undefined),
    create: vi.fn()
  };

  const mockSelectionService = {
    clearDirectorySelection: vi.fn()
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
    mockBookmarksService.remove.mockReset();
    mockSelectionService.clearDirectorySelection.mockReset();

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
    component.folder = {
      id: '123',
      parentId: '1',
      title: 'Empty Folder',
      children: []
    };

    await component.deleteSelectedFolder();

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete "Empty Folder"?');
    expect(mockBookmarksService.remove).toHaveBeenCalledWith('123');
    expect(mockSelectionService.clearDirectorySelection).toHaveBeenCalledTimes(1);
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
});
