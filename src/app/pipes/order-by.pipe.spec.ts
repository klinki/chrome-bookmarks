/* tslint:disable:no-unused-variable */

import {
  waitForAsync, inject, TestBed
} from '@angular/core/testing';
import { OrderByPipe } from './order-by.pipe';

describe('OrderBy Pipe', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [OrderByPipe]
    });
  });

  it('should create an instance', inject([OrderByPipe], (pipe: OrderByPipe) => {
    expect(pipe).toBeTruthy();
  }));
});
