/**
 * @module WeakCache
 */

/**
 * Represents a weak cache for storing key-value pairs.
 * The cache is weak and allows the garbage collector to free up memory for values that are no longer referenced.
 * @class
 */
export default class WeakCache {
  /**
   * Creates a new instance of WeakCache.
   * @constructor
   */
  constructor() {
    this.storage = new Map();
  }

  /**
   * Checks if the cache contains a value associated with the provided key.
   * @param {any} key - The key to check.
   * @returns {boolean} Returns `true` if the cache contains the key, otherwise `false`.
   */
  has(key) {
    if (this.storage.has(key)) {
      const cachedRef = this.storage.get(key);
      const cached = cachedRef.deref();
      if (cached) {
        return true;
      } else {
        this.storage.delete(key);
        return false;
      }
    }
    return false;
  }

  /**
   * Retrieves the value associated with the provided key from the cache.
   * @param {any} key - The key to retrieve.
   * @returns {any} The value associated with the key, or `undefined` if the key is not found or the value has been garbage collected.
   */
  get(key) {
    if (this.storage.has(key)) {
      const cachedRef = this.storage.get(key);
      const cached = cachedRef.deref();
      if (cached) {
        return cached;
      } else {
        this.storage.delete(key);
      }
    }
    return undefined;
  }

  /**
   * Sets the value associated with the provided key in the cache.
   * @param {any} key - The key to set.
   * @param {any} value - The value to be stored in the cache.
   */
  set(key, value) {
    this.storage.set(key, new WeakRef(value));
  }

  /**
   * Deletes the value associated with the provided key from the cache.
   * @param {any} key - The key to delete.
   */
  delete(key) {
    this.storage.delete(key);
  }

  /**
   * Clears the entire cache by removing all key-value pairs.
   */
  clear() {
    this.storage.clear();
  }

  /**
   * Retrieves an iterator for the keys in the cache.
   * @returns {IterableIterator<any>} An iterator for the keys in the cache.
   */
  keys() {
    return this.storage.keys();
  }
}
