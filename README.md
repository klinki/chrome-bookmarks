# GEBOOM (Good Enough Bookmark Manager)

Planned features for this extension:
* Table with name, address, added date with sorting
* Search (possibly keep current functionality)
* Trash for deleted bookmarks
* Drag & Drop (for search as well)

Future features:
* Tags
* Sync with other browsers (and devices)
* Relevance measure (find out how to estimate, most recently visited and mostly visited have bigger relevance than older ones)
* Sharing options

This project was generated with [angular-cli](https://github.com/angular/angular-cli) version 1.0.0-beta.9.
[.editorconfig](.editorconfig)
## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running tests

For fast local iteration, keep the `CI` environment variable unset or empty. Playwright uses its presence to select one worker, enable retries, and require a fresh development server; those safeguards make the suite substantially slower.

```bash
# Unit tests only
npm run test:unit

# End-to-end tests with local parallelism
CI='' npm run test:e2e

# Visible, single-browser E2E run with slowed interactions
CI='' npm run test:e2e:visible

# Complete local suite
CI='' npm test
```

Visible mode adds a 300 ms delay to each Playwright action. Override it when needed, for example with `PLAYWRIGHT_SLOW_MO=750 npm run test:e2e:visible`.

Do not use `CI=false`: it is a non-empty string and therefore enables CI mode. Use CI mode only for final verification:

```bash
CI=1 npm test
npm run lint
npm run build
npm run benchmark
```

As a reference, the complete CI-mode suite currently contains 148 unit tests and 39 end-to-end tests. It took approximately 40 seconds on an Apple M4, while the end-to-end portion took approximately 8.5 seconds with local parallelism. Timings vary by machine.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
