import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListViewComponent } from './list-view.component';
import { SelectionService } from '../../services/selection.service';
import { BookmarksFacadeService } from '../../services/bookmarks-facade.service';
import { TagsService } from '../../services/tags.service';
import { BookmarksService } from '../../services/chrome/bookmarks/bookmarks.service';
import { MockBookmarksService } from '../../services/chrome/bookmarks/mock-bookmarks.service';

describe('Performance: getFavicon', () => {
  let chromeMock: any;
  let optimizedGetFavicon: (urlStr: string | undefined) => string;

  beforeAll(() => {
    chromeMock = {
      runtime: {
        getURL: (path: string) => `chrome-extension://mock-id${path}`
      }
    };
    (global as any).chrome = chromeMock;

    // Initialize optimized logic AFTER chrome is mocked
    const baseUrl = chromeMock.runtime.getURL("/_favicon/") ?? 'https://www.google.com/s2/favicons';
    optimizedGetFavicon = (urlStr: string | undefined) => {
      if (urlStr != null) {
         try {
           return baseUrl + "?pageUrl=" + encodeURIComponent(urlStr) + "&size=16";
         } catch (e) {
           return '';
         }
      }
      return '';
    };
  });

  const originalGetFavicon = (item: { url?: string }) => {
    if (item?.url != null) {
      try {
        const url = new URL((global as any).chrome?.runtime?.getURL("/_favicon/") ?? 'https://www.google.com/s2/favicons');
        url.searchParams.set("pageUrl", item.url);
        url.searchParams.set("size", "16");
        return url.toString();
      } catch (e) {
        return '';
      }
    }
    return '';
  };

  it('should be faster optimized', () => {
    const iterations = 100000;
    const item = { url: "https://www.example.com/some/path" };

    const start1 = performance.now();
    for (let i = 0; i < iterations; i++) {
      originalGetFavicon(item);
    }
    const end1 = performance.now();
    const duration1 = end1 - start1;

    const start2 = performance.now();
    for (let i = 0; i < iterations; i++) {
      optimizedGetFavicon(item.url);
    }
    const end2 = performance.now();
    const duration2 = end2 - start2;

    console.log(`Original: ${duration1.toFixed(2)}ms`);
    console.log(`Optimized: ${duration2.toFixed(2)}ms`);
    console.log(`Improvement: ${(duration1 / duration2).toFixed(2)}x`);

    expect(duration2).toBeLessThan(duration1);
  });
});


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
