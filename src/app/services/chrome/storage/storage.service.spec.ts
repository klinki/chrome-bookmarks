import { waitForAsync, inject, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { StorageService } from './storage.service';

describe('Storage Service', () => {
  beforeEach(() => {
    (window as any).chrome = {
      storage: {
        local: {
          get: vi.fn(),
          set: vi.fn()
        },
        sync: {
           get: vi.fn(),
           set: vi.fn()
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

