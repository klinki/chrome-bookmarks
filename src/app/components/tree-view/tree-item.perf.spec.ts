import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TreeItemComponent } from './tree-item.component';
import { SelectionService } from '../../services';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock SelectionService
class MockSelectionService {
  selectedDirectory = signal(null);
  selectDirectory() {}
}

@Component({
  template: `
    @for (dir of directories(); track dir.id) {
      <app-tree-item [directory]="dir" [level]="0"></app-tree-item>
    }
    <button (click)="triggerChange()">Trigger</button>
  `,
  imports: [TreeItemComponent],
  standalone: true
})
class TestHostComponent {
  directories = signal<any[]>([]);
  dummy = signal(0);

  triggerChange() {
    this.dummy.update(v => v + 1);
  }
}

describe('TreeItemComponent Performance', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, NoopAnimationsModule],
      providers: [
        { provide: SelectionService, useClass: MockSelectionService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
  });

  it('should verify change detection checks', async () => {
    // Create a tree structure
    const tree = [
      {
        id: '1',
        title: 'Folder 1',
        children: [
          { id: '1.1', title: 'Sub 1.1', children: [] },
          { id: '1.2', title: 'Sub 1.2', children: [] }
        ]
      },
      {
        id: '2',
        title: 'Folder 2',
        children: []
      }
    ];

    component.directories.set(tree);
    fixture.detectChanges(); // Initial render
    await fixture.whenStable();

    // Spy on hasSubDirectories
    const spy = vi.spyOn(TreeItemComponent.prototype, 'hasSubDirectories');
    spy.mockClear();

    // Trigger change detection in host without changing inputs to tree
    component.triggerChange();
    fixture.detectChanges();
    await fixture.whenStable();

    const callCount = spy.mock.calls.length;
    expect(callCount).toBe(0);
  });
});
