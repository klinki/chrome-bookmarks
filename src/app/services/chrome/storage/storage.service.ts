import { Injectable } from '@angular/core';
import {StorageArea} from './storage-area.class';

@Injectable()
export class StorageService {
  protected _sync = new StorageArea(chrome.bookmarks.sync);
  protected _local = new StorageArea(chrome.bookmarks.local);
  protected _managed = new StorageArea(chrome.bookmarks.managed);

  constructor() {

  }

  public getSync(): chrome.storage.StorageArea {
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
