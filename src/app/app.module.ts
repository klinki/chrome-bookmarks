import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { FormsModule } from '@angular/forms';
import { Dragula } from 'ng2-dragula/ng2-dragula';
import { FilterBookmarksPipe } from './pipes/filter-bookmarks.pipe';
import { TreeViewComponent } from './components/tree-view/tree-view.component';
import { ListViewComponent } from './components/list-view/list-view.component';
import { SearchBoxComponent } from './components/search-box/search-box.component';

@NgModule({
  declarations: [
    AppComponent,
    Dragula,
    TreeViewComponent,
    ListViewComponent,
    TreeViewComponent,
    SearchBoxComponent,
    FilterBookmarksPipe
  ],
  imports:      [BrowserModule, FormsModule],
  bootstrap:    [AppComponent],
})
export class AppModule {

}
