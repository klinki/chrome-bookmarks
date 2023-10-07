import { FormsModule } from "@angular/forms";
import { BrowserModule, bootstrapApplication } from "@angular/platform-browser";
import { enableProdMode, importProvidersFrom } from "@angular/core";

import {AppComponent} from "./app";
import {DragulaModule} from "ng2-dragula";
import {environment} from "./environments/environment.dev";


if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
    providers: [
      importProvidersFrom(BrowserModule, FormsModule, DragulaModule.forRoot())
    ]
})
.catch(err => console.error(err));
