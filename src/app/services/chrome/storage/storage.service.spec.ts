import { waitForAsync, inject, TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';

describe('Storage Service', () => {
  beforeEach(() => {
    (window as any).chrome = {
      storage: {
        local: {
          get: jasmine.createSpy('get'),
          set: jasmine.createSpy('set')
        },
        sync: {
           get: jasmine.createSpy('get'),
           set: jasmine.createSpy('set')
        }
      }
    };
    TestBed.configureTestingModule({ providers: [StorageService] });
   });

  it('should ...',
    waitForAsync(inject([StorageService], (service: StorageService) => {
      expect(service).toBeTruthy();
    })));
});
