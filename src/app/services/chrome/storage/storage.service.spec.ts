/* tslint:disable:no-unused-variable */

import {
  beforeEach, beforeEachProviders,
  describe, xdescribe,
  expect, it, xit,
  async, inject
} from '@angular/core/testing';
import { StorageService } from './storage.service';

describe('Storage Service', () => {
  beforeEachProviders(() => [StorageService]);

  it('should ...',
      inject([StorageService], (service: StorageService) => {
    expect(service).toBeTruthy();
  }));
});
