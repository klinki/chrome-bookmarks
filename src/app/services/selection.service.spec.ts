/* tslint:disable:no-unused-variable */

import {
  beforeEach, beforeEachProviders,
  describe, xdescribe,
  expect, it, xit,
  async, inject
} from '@angular/core/testing';
import { SelectionService } from './selection.service';

describe('SelectionService Service', () => {
  beforeEachProviders(() => [SelectionService]);

  it('should ...',
      inject([SelectionService], (service: SelectionService) => {
    expect(service).toBeTruthy();
  }));
});
