import '@angular/compiler';

// The analogjs setup-zone module patches vitest test functions for Angular Zone.js compatibility
import '@analogjs/vitest-angular/setup-zone';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

// Polyfill for libraries that expect Node's global
(globalThis as any).global = globalThis;

// Mock chrome API with empty objects so services don't throw when checking chrome.bookmarks or chrome.storage
// Services will use their fallback paths when these are empty
(globalThis as any).chrome = {
  bookmarks: undefined,  // BookmarksService checks chrome.bookmarks
  storage: undefined,    // TagsService checks chrome.storage
};

setupTestBed({
  zoneless: false,
  providers: [],
  browserMode: false,
});
