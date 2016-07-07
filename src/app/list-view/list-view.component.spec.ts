/* tslint:disable:no-unused-variable */

import { By }           from '@angular/platform-browser';
import { DebugElement } from '@angular/core';

import {
  beforeEach, beforeEachProviders,
  describe, xdescribe,
  expect, it, xit,
  async, inject
} from '@angular/core/testing';

import { ListViewComponent } from './list-view.component';

describe('Component: ListView', () => {
  it('should create an instance', () => {
    let component = new ListViewComponent();
    expect(component).toBeTruthy();
  });
});
