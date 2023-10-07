import { Component, OnInit } from '@angular/core';
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
  searchTerm: string = '';

  constructor() {}

  ngOnInit() {
  }

  search() {
    console.log(this.searchTerm);
  }
}
