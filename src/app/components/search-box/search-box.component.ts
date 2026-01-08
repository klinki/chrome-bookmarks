import { Component, EventEmitter, input, OnInit, Output, signal } from '@angular/core';
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
export class SearchBoxComponent implements OnInit {
  public searchTerm = signal('');

  @Output()
  public searchTermChange = new EventEmitter<string>();

  constructor() { }

  ngOnInit() {
  }

  public search() {
    this.searchTermChange.emit(this.searchTerm());
  }
}
