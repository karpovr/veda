// Local client database module

'use strict';

import veda from '../common/veda.js';

const fallback = {
  get: function (key) {
    return Promise.resolve(this[key]);
  },
  put: function (key, value) {
    this[key] = value;
    return Promise.resolve(value);
  },
  remove: function (key) {
    const result = delete this[key];
    return Promise.resolve(result);
  },
};

export default LocalDB;

/**
 * Local database singleton constructor
 * @return {Promise} database instance promise
 */
function LocalDB() {
  const self = this;
  const veda_version = veda.manifest.veda_version;
  this.db_name = veda.manifest.short_name;
  this.store_name = 'store';

  // Singleton pattern
  if (LocalDB.prototype[this.db_name + this.store_name]) {
    return Promise.resolve(LocalDB.prototype[this.db_name + this.store_name]);
  }

  return LocalDB.prototype[this.db_name + this.store_name] = initDB(this.db_name, this.store_name, veda_version);

  /**
   * Initialize database instance
   * @param {string} db_name - database name
   * @param {string} store_name - database store name
   * @return {Promise} database instance promise
   */
  function initDB(db_name, store_name, veda_version) {
    return new Promise(function (resolve, reject) {
      const openReq = window.indexedDB.open(db_name, veda_version);

      openReq.onsuccess = function (event) {
        const db = event.target.result;
        self.db = db;
        console.log(`DB open success, veda_version = ${veda_version}`);
        resolve(self);
      };

      openReq.onerror = function errorHandler(error) {
        console.log('DB open error', error);
        reject(error);
      };

      openReq.onupgradeneeded = function (event) {
        const db = event.target.result;
        if (db.objectStoreNames.contains(store_name)) {
          db.deleteObjectStore(store_name);
          console.log(`DB store deleted: ${store_name}`);
        }
        db.createObjectStore(self.store_name);
        console.log(`DB create success: ${store_name}, veda_version = ${veda_version}`);
      };
    }).catch((error) => {
      console.log('IndexedDB error, using in-memory fallback.', error);
      return fallback;
    });
  }
};

const proto = LocalDB.prototype;

proto.get = function (key) {
  const self = this;
  return new Promise(function (resolve, reject) {
    const request = self.db.transaction([self.store_name], 'readonly').objectStore(self.store_name).get(key);
    request.onerror = reject;
    request.onsuccess = (event) => resolve(event.target.result);
  });
};

proto.put = function (key, value) {
  const self = this;
  return new Promise(function (resolve, reject) {
    const request = self.db.transaction([self.store_name], 'readwrite').objectStore(self.store_name).put(value, key);
    request.onerror = reject;
    request.onsuccess = () => resolve(value);
  });
};

proto.remove = function (key) {
  const self = this;
  return new Promise(function (resolve, reject) {
    const request = self.db.transaction([self.store_name], 'readwrite').objectStore(self.store_name).delete(key);
    request.onerror = reject;
    request.onsuccess = (event) => resolve(event.target.result);
  });
};

