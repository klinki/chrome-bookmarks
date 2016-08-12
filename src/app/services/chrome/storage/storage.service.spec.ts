/* tslint:disable:no-unused-variable */

import {
  async, inject, TestBed
} from '@angular/core/testing';
import { StorageService } from './storage.service';

describe('Storage Service', () => {
  beforeEach(() => {
     TestBed.configureTestingModule([StorageService]);
   });

  it('should ...',
      inject([StorageService], (service: StorageService) => {
    expect(service).toBeTruthy();
  }));
});
