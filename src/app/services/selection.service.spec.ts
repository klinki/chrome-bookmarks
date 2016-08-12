/* tslint:disable:no-unused-variable */

import {
  async, inject, TestBed
} from '@angular/core/testing';
import { SelectionService } from './selection.service';

describe('SelectionService Service', () => {
  beforeEach(() => {
     TestBed.configureTestingModule([SelectionService]);
   });

  it('should ...',
      inject([SelectionService], (service: SelectionService) => {
    expect(service).toBeTruthy();
  }));
});
