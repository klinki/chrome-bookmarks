export class StorageArea {

  protected storage: chrome.storage.StorageArea;

  constructor(storage: chrome.storage.StorageArea) {
    this.storage = storage;
  }

  /**
   * Gets the amount of space (in bytes) being used by one or more items.
   *
   * @returns {Promise<number>} Callback with the amount of space being used by storage, or on failure (in which case runtime.lastError will be set).
   *                            Parameter bytesInUse: Amount of space being used in storage, in bytes.
   */
  public getBytesInUse(): Promise<number>;

  /**
   * Gets the amount of space (in bytes) being used by one or more items.
   *
   * @param key A single key to get the total usage for. Pass in null to get the total usage of all of storage.
   * @returns {Promise<number>} Callback with the amount of space being used by storage, or on failure (in which case runtime.lastError will be set).
   *                            Parameter bytesInUse: Amount of space being used in storage, in bytes.
   */
  public getBytesInUse(key: string): Promise<number>;

  /**
   * Gets the amount of space (in bytes) being used by one or more items.
   *
   * @param keys A list of keys to get the total usage for. An empty list will return 0. Pass in null to get the total usage of all of storage.
   * @returns {Promise<number>} Callback with the amount of space being used by storage, or on failure (in which case runtime.lastError will be set).
   *                            Parameter bytesInUse: Amount of space being used in storage, in bytes.
   */
  public getBytesInUse(keys: string[]): Promise<number>;
  public getBytesInUse(keys?: string|string[]): Promise<number> {
    if (keys === undefined) {
      return new Promise((resolve, error) => this.storage.getBytesInUse(resolve));
    } else {
      return new Promise((resolve, error) => this.storage.getBytesInUse(keys as any, resolve));
    }
  }

  /**
   * Removes all items from storage.
   *
   * @returns {Promise<void>} on success, or on failure (in which case runtime.lastError will be set).
   */
  public clear(): Promise<any> {
    return new Promise((resolve, error) => this.storage.clear(resolve as any));
  }

  /**
   * Sets multiple items.
   *
   * @param items An object which gives each key/value pair to update storage with. Any other key/value pairs in storage will not be affected.
   *          Primitive values such as numbers will serialize as expected. Values with a typeof "object" and "function" will typically serialize to {},
   *          with the exception of Array (serializes as expected), Date, and Regex (serialize using their String representation).
   * @returns {Promise<void>} on success, or on failure (in which case runtime.lastError will be set).
   */
  public set(items: Object): Promise<any> {
    return new Promise((resolve, error) => this.storage.set(items, resolve as any));
  };

  /**
   * Removes one item from storage.
   *
   * @param key A single key for items to remove.
   * @returns {Promise<void>} on success, or on failure (in which case runtime.lastError will be set).
   */
  public remove(key: string): Promise<any>;

  /**
   * Removes items from storage.
   *
   * @param keys A list of keys for items to remove.
   * @returns {Promise<void>} on success, or on failure (in which case runtime.lastError will be set).
   */
  public remove(keys: string[]): Promise<any>;
  public remove(keys: string|string[]): Promise<any> {
    return new Promise((resolve, error) => this.storage.remove(keys as any, resolve as any));
  }

  /**
   * Gets one or more items from storage.
   *
   * @returns {Promise} Callback with storage items, or on failure (in which case runtime.lastError will be set).
   *                    Parameter items: Object with items in their key-value mappings.
   */
  public get(): Promise<{ [key: string]: any }>;

  /**
   * Gets one or more items from storage.
   *
   * @param key A single key to get. Pass in null to get the entire contents of storage.
   * @returns {Promise} Callback with storage items, or on failure (in which case runtime.lastError will be set).
   *                    Parameter items: Object with items in their key-value mappings.
   */
  public get(key: string): Promise<{ [key: string]: any }>;
  /**
   * Gets one or more items from storage.
   *
   * @param keys A list of keys to get. An empty list or object will return an empty result object. Pass in null to get the entire contents of storage.
   * @returns {Promise} Callback with storage items, or on failure (in which case runtime.lastError will be set).
   *                    Parameter items: Object with items in their key-value mappings.
   */
  public get(keys: string[]): Promise<{ [key: string]: any }>;
  /**
   * Gets one or more items from storage.
   *
   * @param keys A dictionary specifying default values. Pass in null to get the entire contents of storage.
   * @returns {Promise} Callback with storage items, or on failure (in which case runtime.lastError will be set).
   *                    Parameter items: Object with items in their key-value mappings.
   */
  public get(keys: Object): Promise<{ [key: string]: any }>;

  public get(keys?: string|string[]|Object): Promise<{ [key: string]: any }> {
    if (keys === undefined) {
      return new Promise((resolve, error) => this.storage.get(resolve));
    } else {
      return new Promise((resolve, error) => this.storage.get(keys, resolve));
    }
  }
}
