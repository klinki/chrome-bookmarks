import { Component, EventEmitter, Input, Output, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from "@angular/forms";
import { SearchParseError } from '../../services/search.types';

@Component({
  standalone: true,
  selector: 'app-search-box',
  templateUrl: 'search-box.component.html',
  imports: [
    FormsModule
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['search-box.component.scss']
})
export class SearchBoxComponent {
  public searchTerm = signal('');
  private queryValue = '';
  @Input()
  public set query(value: string) {
    this.queryValue = value;
    this.searchTerm.set(value);
  }
  public get query(): string {
    return this.queryValue;
  }
  @Input() public error: SearchParseError | null = null;
  @Input() public chips: ReadonlyArray<string> = [];
  @Input() public folders: ReadonlyArray<chrome.bookmarks.BookmarkTreeNode> = [];
  @Input() public scopeFolderId?: string;
  @Input() public selectedCollectionName?: string;
  public filtersOpen = signal(false);
  public filterField = signal('title');
  public filterValue = signal('');

  @Output()
  public searchTermChange = new EventEmitter<string>();

  @Output()
  public scopeFolderIdChange = new EventEmitter<string | undefined>();

  @Output()
  public chipRemove = new EventEmitter<number>();

  @Output()
  public canonicalize = new EventEmitter<void>();

  @Output() public collectionCreate = new EventEmitter<void>();
  @Output() public collectionUpdate = new EventEmitter<void>();
  @Output() public collectionEdit = new EventEmitter<void>();
  @Output() public collectionRename = new EventEmitter<void>();
  @Output() public collectionDuplicate = new EventEmitter<void>();
  @Output() public collectionDelete = new EventEmitter<void>();

  public search() {
    this.searchTermChange.emit(this.searchTerm());
  }

  public applyFilter(): void {
    const value = this.filterValue().trim();
    if (!value) {
      return;
    }
    const escaped = /[\s()"\\:]/u.test(value)
      ? `"${value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')}"`
      : value;
    const clause = `${this.filterField()}:${escaped}`;
    this.searchTerm.set(this.searchTerm().trim()
      ? `${this.searchTerm().trim()} AND ${clause}`
      : clause);
    this.filterValue.set('');
    this.search();
  }
}
