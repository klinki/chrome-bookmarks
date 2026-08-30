import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { BookmarksProviderService } from '../../../services/bookmarks-provider.service';
import { CleanupSettingsService } from '../../../services/cleanup-settings.service';
import { OrganizeCleanupSettingsComponent } from './organize-cleanup-settings.component';

describe('OrganizeCleanupSettingsComponent', () => {
  let fixture: ComponentFixture<OrganizeCleanupSettingsComponent>;
  let component: OrganizeCleanupSettingsComponent;
  const settings = {
    settings: signal({ staleDays: 730, excludedFolderIds: [] as string[] }),
    update: vi.fn((changes: { excludedFolderIds?: string[] }) => {
      settings.settings.update(current => ({ ...current, ...changes }));
    })
  };
  const provider = {
    getBookmarks: vi.fn().mockResolvedValue([{
      id: '0',
      title: 'root',
      children: [{
        id: '1',
        parentId: '0',
        title: 'Bookmarks Bar',
        children: [{
          id: '2',
          parentId: '1',
          title: 'Reference',
          children: [{ id: 'a', parentId: '2', title: 'Angular', url: 'https://angular.dev' }]
        }]
      }]
    }] as chrome.bookmarks.BookmarkTreeNode[])
  };

  beforeEach(async () => {
    settings.settings.set({ staleDays: 730, excludedFolderIds: [] });
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [OrganizeCleanupSettingsComponent],
      providers: [
        { provide: BookmarksProviderService, useValue: provider },
        { provide: CleanupSettingsService, useValue: settings }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(OrganizeCleanupSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads nested folder paths and manages exclusions', () => {
    expect(component.folders()).toEqual([
      { id: '1', path: 'Bookmarks Bar' },
      { id: '2', path: 'Bookmarks Bar / Reference' }
    ]);

    component.selectedFolderId.set('2');
    component.addExcludedFolder();
    expect(settings.update).toHaveBeenCalledWith({ excludedFolderIds: ['2'] });
    expect(component.excludedFolders()).toEqual([{ id: '2', path: 'Bookmarks Bar / Reference' }]);

    component.removeExcludedFolder('2');
    expect(settings.update).toHaveBeenLastCalledWith({ excludedFolderIds: [] });
  });
});
