/* tslint:disable:no-unused-variable */

import { waitForAsync, inject, TestBed } from '@angular/core/testing';
import { SelectionService } from './selection.service';

describe('SelectionService Service', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SelectionService] });
   });

  it('should ...',
    waitForAsync(inject([SelectionService], (service: SelectionService) => {
      expect(service).toBeTruthy();
    })));
});
