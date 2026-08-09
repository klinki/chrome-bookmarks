import { Component, EventEmitter, Output, signal } from '@angular/core';
import { FormsModule } from "@angular/forms";

@Component({
  standalone: true,
  selector: 'app-search-box',
  templateUrl: 'search-box.component.html',
  imports: [
    FormsModule
  ],
  styleUrls: ['search-box.component.scss']
})
export class SearchBoxComponent {
  public searchTerm = signal('');

  @Output()
  public searchTermChange = new EventEmitter<string>();


  public search() {
    this.searchTermChange.emit(this.searchTerm());
  }
}
