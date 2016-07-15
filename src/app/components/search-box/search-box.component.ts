import { Component, OnInit } from '@angular/core';

@Component({
  moduleId: module.id,
  selector: 'app-search-box',
  templateUrl: 'search-box.component.html',
  styleUrls: ['search-box.component.css']
})
export class SearchBoxComponent implements OnInit {
  searchTerm;

  constructor() {}

  ngOnInit() {
  }

  search() {
    console.log(this.searchTerm);
  }
}
