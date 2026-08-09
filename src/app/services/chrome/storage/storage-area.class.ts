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
    return this.storage.getBytesInUse(keys);
  }

  /**
   * Removes all items from storage.
   *
   * @returns {Promise<void>} on success, or on failure (in which case runtime.lastError will be set).
   */
  public clear(): Promise<void> {
    return this.storage.clear();
  }

  /**
   * Sets multiple items.
   *
   * @param items An object which gives each key/value pair to update storage with. Any other key/value pairs in storage will not be affected.
   *          Primitive values such as numbers will serialize as expected. Values with a typeof "object" and "function" will typically serialize to {},
   *          with the exception of Array (serializes as expected), Date, and Regex (serialize using their String representation).
   * @returns {Promise<void>} on success, or on failure (in which case runtime.lastError will be set).
   */
  public set(items: Record<string, unknown>): Promise<void> {
    return this.storage.set(items);
  }

  /**
   * Removes one item from storage.
   *
   * @param key A single key for items to remove.
   * @returns {Promise<void>} on success, or on failure (in which case runtime.lastError will be set).
   */
  public remove(key: string): Promise<void>;

  /**
   * Removes items from storage.
   *
   * @param keys A list of keys for items to remove.
   * @returns {Promise<void>} on success, or on failure (in which case runtime.lastError will be set).
   */
  public remove(keys: string[]): Promise<void>;
  public remove(keys: string|string[]): Promise<void> {
    return this.storage.remove(keys);
  }

  /**
   * Gets one or more items from storage.
   *
   * @returns {Promise} Callback with storage items, or on failure (in which case runtime.lastError will be set).
   *                    Parameter items: Object with items in their key-value mappings.
   */
  public get(): Promise<Record<string, unknown>>;

  /**
   * Gets one or more items from storage.
   *
   * @param key A single key to get. Pass in null to get the entire contents of storage.
   * @returns {Promise} Callback with storage items, or on failure (in which case runtime.lastError will be set).
   *                    Parameter items: Object with items in their key-value mappings.
   */
  public get(key: string): Promise<Record<string, unknown>>;
  /**
   * Gets one or more items from storage.
   *
   * @param keys A list of keys to get. An empty list or object will return an empty result object. Pass in null to get the entire contents of storage.
   * @returns {Promise} Callback with storage items, or on failure (in which case runtime.lastError will be set).
   *                    Parameter items: Object with items in their key-value mappings.
   */
  public get(keys: string[]): Promise<Record<string, unknown>>;
  /**
   * Gets one or more items from storage.
   *
   * @param keys A dictionary specifying default values. Pass in null to get the entire contents of storage.
   * @returns {Promise} Callback with storage items, or on failure (in which case runtime.lastError will be set).
   *                    Parameter items: Object with items in their key-value mappings.
   */
  public get(keys: Record<string, unknown>): Promise<Record<string, unknown>>;

  public get(keys?: string|string[]|Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.storage.get(keys);
  }
}
