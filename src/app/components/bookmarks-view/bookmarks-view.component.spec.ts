/* tslint:disable:no-unused-variable */

import { By }           from '@angular/platform-browser';
import { DebugElement } from '@angular/core';

import {
  beforeEach, beforeEachProviders,
  describe, xdescribe,
  expect, it, xit,
  async, inject
} from '@angular/core/testing';

import { BookmarksViewComponent } from './bookmarks-view.component';

describe('Component: BookmarksView', () => {
  it('should create an instance', () => {
    let component = new BookmarksViewComponent(null);
    expect(component).toBeTruthy();
  });
});
