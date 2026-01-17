import { FormsModule } from "@angular/forms";
import { BrowserModule, bootstrapApplication } from "@angular/platform-browser";
import { enableProdMode, importProvidersFrom, provideZoneChangeDetection } from "@angular/core";
import { AppComponent } from "./app";

import { environment } from "./environments/environment";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { provideRouter, withHashLocation } from "@angular/router";

import { routes } from "./app/app.routes";
import { BookmarksProviderService, SelectionService } from './app/services';
import { BookmarksServiceProvider } from './app/shared/providers';
import { BookmarksFacadeService } from "./app/services/bookmarks-facade.service";
import { DragAndDropService } from "./app/services/drag-and-drop.service";

if (environment.production) {
  enableProdMode();
}

console.log('isE2E:', (window as any).isE2E);

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),
    provideRouter(routes, withHashLocation()),
    importProvidersFrom(BrowserModule, FormsModule),
    provideNoopAnimations(),
    BookmarksServiceProvider,
    BookmarksProviderService,
    SelectionService,
    BookmarksFacadeService,
    DragAndDropService,
  ]
})
  .catch(err => console.error(err));
