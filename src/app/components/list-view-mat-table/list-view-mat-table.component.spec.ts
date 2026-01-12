import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListViewMatTableComponent } from './list-view-mat-table.component';
import { SelectionService } from '../../services/selection.service';
import { BookmarksFacadeService } from '../../services/bookmarks-facade.service';
import { TagsService } from '../../services/tags.service';
import { signal } from '@angular/core';
import { DragAndDropService } from '../../services/drag-and-drop.service';

xdescribe('ListViewMatTableComponent', () => {
  let component: ListViewMatTableComponent;
  let fixture: ComponentFixture<ListViewMatTableComponent>;

  const mockSelectionService = {
    selection: signal(new Set()),
    selectAllActive: signal(false),
    select: jasmine.createSpy('select'),
    items: [],
    itemsSignal: signal([])
  };

  const mockBookmarksFacade = {
    items: signal([])
  };

  const mockTagsService = {};
  const mockDragAndDropService = {};

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ ListViewMatTableComponent ],
      providers: [
        { provide: SelectionService, useValue: mockSelectionService },
        { provide: BookmarksFacadeService, useValue: mockBookmarksFacade },
        { provide: TagsService, useValue: mockTagsService },
        { provide: DragAndDropService, useValue: mockDragAndDropService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListViewMatTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
