// Veda application Model

import riot from '../common/lib/riot.js';

import OntologyModel from '../common/ontology_model.js';

import UserModel from '../common/user_model.js';

import UpdateService from '../browser/update_service.js';

/**
 * Application model
 * @param {Object} manifest - app config
 * @return {AppModel}
 */
export default function AppModel (manifest) {
  riot.observable(this);

  this.manifest = manifest;
  this.ticket = this.ticket || '';
  this.ontology = {};
  this.cache = {
    limit: 20000,
    count: 0,
    delta: 1000,
    storage: {},
    expire: {},
    get: function (key) {
      return this.storage[key];
    },
    set: function (obj, expires) {
      let count = this.count;
      const limit = this.limit;
      const delta = this.delta;
      if ( count >= limit ) {
        const keys = Object.keys(this.expire);
        // First key is for ontology objects
        for (let i = 1, key; (key = keys[i]) && (limit - count < delta); i++) {
          this.expire[key] = this.expire[key].filter((obj) => {
            if (limit - count >= delta) {
              return true;
            }
            delete this.storage[obj.id];
            count--;
            return false;
          });
          if (this.expire[key].length === 0) {
            delete this.expire[key];
          }
        }
        this.count = count;
        console.log('veda.cache limit (' + this.limit + ' elements) reached, ' + this.delta + ' removed.');
      }
      const expire_key = typeof expires === 'number' ? expires : Date.now();
      obj.expires = expire_key;
      this.storage[obj.id] = obj;
      this.expire[expire_key] = this.expire[expire_key] || [];
      this.expire[expire_key].push(obj);
      this.count++;
      if (typeof window !== 'undefined' && expire_key !== 1) {
        const updateService = new UpdateService();
        updateService.then((updateService) => {
          updateService.subscribe(obj.id);
        });
      }
    },
    remove: function (key) {
      const obj = this.storage[key];
      const expires = obj.expires;
      this.expire[expires] = this.expire[expires].filter((item) => item.id !== key);
      if (this.expire[expires].length === 0) {
        delete this.expire[expires];
      }
      this.count--;
      if (typeof window !== 'undefined') {
        const updateService = new UpdateService();
        updateService.then((updateService) => {
          updateService.unsubscribe(key);
        });
      }
      return delete this.storage[key];
    },
    clear: function () {
      this.count = 0;
      this.storage = {};
      this.expire = {};
      if (typeof window !== 'undefined') {
        const updateService = new UpdateService();
        updateService.then((updateService) => {
          updateService.unsubscribe();
        });
      }
    },
  };

  // Load ontology
  this.init = function (user) {
    const ontology = new OntologyModel();
    return ontology.then((ontology) => {
      this.ontology = ontology;
      this.user = new UserModel(user);
      return this.user._init();
    });
  };

  return this;
};
