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
    settings: signal({
      staleDays: 730,
      cleanupExcludedFolderIds: [] as string[],
      organizeExcludedFolderIds: [] as string[]
    }),
    update: vi.fn((changes: { cleanupExcludedFolderIds?: string[]; organizeExcludedFolderIds?: string[] }) => {
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
    settings.settings.set({
      staleDays: 730,
      cleanupExcludedFolderIds: [],
      organizeExcludedFolderIds: []
    });
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

  it('loads a nested folder tree and keeps exclusions independent', () => {
    expect(fixture.nativeElement.querySelectorAll('select')).toHaveLength(0);
    expect(fixture.nativeElement.querySelectorAll('[role="tree"]')).toHaveLength(2);
    expect(component.folders()).toEqual([{
      id: '1',
      title: 'Bookmarks Bar',
      children: [{
        id: '2',
        title: 'Reference',
        children: []
      }]
    }]);

    component.updateCleanupExclusions(new Set(['2']));
    expect(settings.update).toHaveBeenCalledWith({ cleanupExcludedFolderIds: ['2'] });

    component.updateOrganizeExclusions(new Set(['1']));
    expect(settings.update).toHaveBeenCalledWith({ organizeExcludedFolderIds: ['1'] });
  });
});
