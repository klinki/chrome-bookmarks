import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FolderIconComponent } from './folder-icon.component';
import { MatIconModule } from '@angular/material/icon';
import { By } from '@angular/platform-browser';

describe('FolderIconComponent', () => {
  let component: FolderIconComponent;
  let fixture: ComponentFixture<FolderIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FolderIconComponent, MatIconModule],
    }).compileComponents();

    fixture = TestBed.createComponent(FolderIconComponent);
    component = fixture.componentInstance;
  });

  it('should display "bookmarks" for ROOT_ALL', () => {
    fixture.componentRef.setInput('item', { id: 'ROOT_ALL' });
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon.getAttribute('fontIcon')).toBe('bookmarks');
  });

  it('should display "label" for TAG_ prefixed IDs', () => {
    fixture.componentRef.setInput('item', { id: 'TAG_123' });
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon.getAttribute('fontIcon')).toBe('label');
  });

  it('should display "label" for ROOT_TAGS', () => {
    fixture.componentRef.setInput('item', { id: 'ROOT_TAGS' });
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon.getAttribute('fontIcon')).toBe('label');
  });

  it('should display "dns" for SERVER_ prefixed IDs', () => {
    fixture.componentRef.setInput('item', { id: 'SERVER_456' });
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon.getAttribute('fontIcon')).toBe('dns');
  });

  it('should display "dns" for ROOT_SERVERS', () => {
    fixture.componentRef.setInput('item', { id: 'ROOT_SERVERS' });
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon.getAttribute('fontIcon')).toBe('dns');
  });

  it('should display "folder" for regular items when collapsed', () => {
    fixture.componentRef.setInput('item', { id: 'regular' });
    fixture.componentRef.setInput('expanded', false);
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon.getAttribute('fontIcon')).toBe('folder');
  });

  it('should display "folder_open" for regular items when expanded', () => {
    fixture.componentRef.setInput('item', { id: 'regular' });
    fixture.componentRef.setInput('expanded', true);
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon.getAttribute('fontIcon')).toBe('folder_open');
  });
});
