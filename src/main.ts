import { FormsModule } from "@angular/forms";
import { BrowserModule, bootstrapApplication } from "@angular/platform-browser";
import { enableProdMode, importProvidersFrom } from "@angular/core";

import {AppComponent} from "./app";
import {DragulaModule} from "ng2-dragula";
import {environment} from "./environments/environment.dev";
import {provideNoopAnimations} from "@angular/platform-browser/animations";


if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
    providers: [
      importProvidersFrom(BrowserModule, FormsModule, DragulaModule.forRoot()),
      provideNoopAnimations()
    ]
})
.catch(err => console.error(err));
