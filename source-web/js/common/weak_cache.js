// Weak cache

export default class WeakCache {
  constructor () {
    this.storage = new Map();
  }

  has (key) {
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
  }

  get (key) {
    if (this.storage.has(key)) {
      const cachedRef = this.storage.get(key);
      const cached = cachedRef.deref();
      if (cached) {
        return cached;
      } else {
        this.storage.delete(key);
      }
    }
  }

  set (key, value) {
    this.storage.set(key, new WeakRef(value));
  }

  delete (key) {
    this.storage.delete(key);
  }

  clear () {
    this.storage.clear();
  }

  keys () {
    return this.storage.keys();
  }
}
