import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FolderMenuComponent } from './folder-menu.component';

import { BookmarksService } from '../../../services/chrome/bookmarks/bookmarks.service';
import { MockBookmarksService } from '../../../services/chrome/bookmarks/mock-bookmarks.service';

describe('FolderMenuComponent', () => {
  let component: FolderMenuComponent;
  let fixture: ComponentFixture<FolderMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ FolderMenuComponent ],
      providers: [
        { provide: BookmarksService, useClass: MockBookmarksService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FolderMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
