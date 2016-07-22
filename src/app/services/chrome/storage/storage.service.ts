import { Injectable } from '@angular/core';
import { StorageArea } from './storage-area.class';

@Injectable()
export class StorageService {
  protected _sync = new StorageArea(chrome.storage.sync);
  protected _local = new StorageArea(chrome.storage.local);
  protected _managed = new StorageArea(chrome.storage.managed);

  constructor() {

  }

  public getSync(): StorageArea {
    return this._sync;
  }

  get sync(): StorageArea {
      return this._sync;
  }

  get local(): StorageArea{
      return this._local;
  }

  get managed(): StorageArea{
      return this._managed;
  }
}
