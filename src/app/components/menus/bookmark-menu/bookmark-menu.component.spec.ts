import { ComponentFixture, TestBed } from '@angular/core/testing';
import { type MockInstance, vi } from 'vitest';
import { BookmarkMenuComponent } from './bookmark-menu.component';
import { BookmarksService } from '../../../services/chrome/bookmarks/bookmarks.service';


describe('BookmarkMenuComponent', () => {
  let component: BookmarkMenuComponent;
  let fixture: ComponentFixture<BookmarkMenuComponent>;
  let alertSpy: MockInstance;

  const mockBookmarksService = {
    remove: vi.fn()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookmarkMenuComponent],
      providers: [
        { provide: BookmarksService, useValue: mockBookmarksService }
      ]
    }).compileComponents();

    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockBookmarksService.remove.mockReset();
    mockBookmarksService.remove.mockResolvedValue(undefined);

    fixture = TestBed.createComponent(BookmarkMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reports bookmark deletion failures', async () => {
    mockBookmarksService.remove.mockRejectedValueOnce(new Error('Remove failed'));
    component.bookmark = {
      id: '123',
      title: 'Bookmark',
      url: 'https://example.com'
    };

    await component.delete();

    expect(mockBookmarksService.remove).toHaveBeenCalledWith('123');
    expect(alertSpy).toHaveBeenCalledWith('Failed to delete bookmark.');
  });
});
