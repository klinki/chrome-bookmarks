import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormsModule} from "@angular/forms";

@Component({
  standalone: true,
  selector: 'app-search-box',
  templateUrl: 'search-box.component.html',
  imports: [
    FormsModule
  ],
  styleUrls: ['search-box.component.css']
})
export class SearchBoxComponent implements OnInit {
  @Input()
  searchTerm: string = '';

  @Output()
  searchTermChange = new EventEmitter<string>();

  constructor() {}

  ngOnInit() {
  }

  search() {
    this.searchTermChange.emit(this.searchTerm);
  }
}
