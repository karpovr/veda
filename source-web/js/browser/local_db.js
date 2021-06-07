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
function LocalDB () {
  this.veda_version = veda.manifest.veda_version;
  this.db_name = veda.manifest.short_name;
  this.store_name = 'store';

  // Singleton pattern
  if (LocalDB.prototype[this.db_name + this.store_name]) {
    return Promise.resolve(LocalDB.prototype[this.db_name + this.store_name]);
  }

  return LocalDB.prototype[this.db_name + this.store_name] = this.initDB();
};

const proto = LocalDB.prototype;

/**
 * Initialize database instance
 * @return {Promise} database instance promise
 */
proto.initDB = function () {
  return new Promise((resolve, reject) => {
    const openReq = window.indexedDB.open(this.db_name, this.veda_version);

    openReq.onsuccess = (event) => {
      const db = event.target.result;
      this.db = db;
      console.log(`DB open success, veda_version = ${this.veda_version}`);
      resolve(this);
    };

    openReq.onerror = (error) => {
      console.log('DB open error', error);
      reject(error);
    };

    openReq.onblocked = function (event) {
      alert('Пожалуйста, закройте другие открытые вкладки системы! \nPlease close all other open tabs with the system!');
    };

    openReq.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (db.objectStoreNames.contains(this.store_name)) {
        db.deleteObjectStore(this.store_name);
        console.log(`DB store deleted: ${this.store_name}`);
      }
      db.createObjectStore(this.store_name);
      console.log(`DB create success: ${this.store_name}, veda_version = ${this.veda_version}`);
    };
  }).catch((error) => {
    console.log('IndexedDB error, using in-memory fallback.', error);
    return fallback;
  });
};

proto.get = function (key) {
  return new Promise((resolve, reject) => {
    const request = this.db.transaction([this.store_name], 'readonly').objectStore(this.store_name).get(key);
    request.onerror = reject;
    request.onsuccess = (event) => resolve(event.target.result);
  });
};

proto.put = function (key, value) {
  return new Promise((resolve, reject) => {
    const request = this.db.transaction([this.store_name], 'readwrite').objectStore(this.store_name).put(value, key);
    request.onerror = reject;
    request.onsuccess = () => resolve(value);
  });
};

proto.remove = function (key) {
  return new Promise((resolve, reject) => {
    const request = this.db.transaction([this.store_name], 'readwrite').objectStore(this.store_name).delete(key);
    request.onerror = reject;
    request.onsuccess = (event) => resolve(event.target.result);
  });
};

