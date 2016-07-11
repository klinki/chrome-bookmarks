/* tslint:disable:no-unused-variable */

import {
  beforeEach, beforeEachProviders,
  describe, xdescribe,
  expect, it, xit,
  async, inject
} from '@angular/core/testing';
import { OrderByPipe } from './order-by.pipe';

describe('Pipe: OrderBy', () => {
  it('create an instance', () => {
    let pipe = new OrderByPipe();
    expect(pipe).toBeTruthy();
  });
});
