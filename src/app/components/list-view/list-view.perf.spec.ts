import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListViewComponent } from './list-view.component';
import { SelectionService } from '../../services/selection.service';
import { BookmarksFacadeService } from '../../services/bookmarks-facade.service';
import { TagsService } from '../../services/tags.service';
import { BookmarksService } from '../../services/chrome/bookmarks/bookmarks.service';
import { MockBookmarksService } from '../../services/chrome/bookmarks/mock-bookmarks.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';

@Component({
  template: `<app-list-view [items]="items" [columns]="columns"></app-list-view>`,
  imports: [ListViewComponent]
})
class HostComponent {
  items: chrome.bookmarks.BookmarkTreeNode[] = [];
  columns: string[] = ['title', 'url', 'dateAdded', 'dateLastUsed', 'tags'];
}

describe('ListViewComponent Performance', () => {
  let fixture: ComponentFixture<HostComponent>;
  let hostComponent: HostComponent;
  let listViewComponent: ListViewComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, ListViewComponent],
      providers: [
        { provide: SelectionService, useValue: {
            selectAllActive: signal(false),
            itemsSignal: signal([]),
            selection: signal(new Set()),
            select: vi.fn(),
            clearSelection: vi.fn()
          }
        },
        { provide: BookmarksFacadeService, useValue: { items: signal([]) } },
        { provide: TagsService, useValue: { getTagsForBookmark: vi.fn().mockReturnValue([]) } },
        { provide: BookmarksService, useClass: MockBookmarksService }
      ]
    }).compileComponents();
  });

  it('should reduce change detection cycles with OnPush', () => {
    fixture = TestBed.createComponent(HostComponent);
    hostComponent = fixture.componentInstance;

    // Create 100 items
    const items: chrome.bookmarks.BookmarkTreeNode[] = Array.from({ length: 100 }, (_, i) => ({
      id: `${i}`,
      title: `Item ${i}`,
      url: `http://example.com/${i}`,
      dateAdded: Date.now(),
      dateLastUsed: Date.now(),
      parentId: '1',
      index: i,
      unmodifiable: undefined,
      children: undefined
    }));
    hostComponent.items = items;

    fixture.detectChanges(); // Initial render

    listViewComponent = fixture.debugElement.children[0].componentInstance;

    // Spy on getColumnValue
    const spy = vi.spyOn(listViewComponent, 'getColumnValue');

    // Trigger change detection 10 times without changing inputs
    for (let i = 0; i < 10; i++) {
      fixture.detectChanges();
    }

    // With Default strategy, this should be high (100 items * 5 columns * 10 cycles = 5000 calls).
    // With OnPush, this should be 0 (since inputs didn't change and we are not marking for check).
    // The spy is attached AFTER initial render, so initial calls are not counted.

    expect(spy.mock.calls.length).toBe(0);
  });
});
