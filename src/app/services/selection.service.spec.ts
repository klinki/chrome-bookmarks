import { TestBed } from '@angular/core/testing';
import { SelectionService } from './selection.service';

describe('SelectionService', () => {
  let service: SelectionService;

  function item(id: string): chrome.bookmarks.BookmarkTreeNode {
    return { id, title: `Item ${id}` } as chrome.bookmarks.BookmarkTreeNode;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SelectionService]
    });

    service = TestBed.inject(SelectionService);
  });

  it('selects a contiguous range from the last selected item', () => {
    const items = [item('1'), item('2'), item('3'), item('4')];
    service.items = items;

    service.select(items[0], { clear: true });
    service.select(items[2], { clear: true, range: true });

    expect(service.selection()).toEqual(new Set(['1', '2', '3']));
  });

  it('falls back to the clicked item when the range anchor was cleared', () => {
    const firstList = [item('1'), item('2'), item('3')];
    const secondList = [item('4'), item('5'), item('6')];

    service.items = firstList;
    service.select(firstList[0], { clear: true });

    service.clearSelection();
    service.items = secondList;

    service.select(secondList[1], { clear: true, range: true });

    expect(service.selection()).toEqual(new Set(['5']));
  });
});
