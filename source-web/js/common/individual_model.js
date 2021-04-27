// Class to manipulate individuals.

'use strict';

import veda from '../common/veda.js';

import riot from '../common/lib/riot.js';

import Backend from '../common/backend.js';

import Util from '../common/util.js';

export default veda.IndividualModel = IndividualModel;

/**
 * @constructor
 * @param {string} uri URI of individual. If not specified, than id of individual will be generated automatically.
 * @param {boolean} cache Use cache true / false. If true or not set, then object will be return from application cache (veda.cache). If false or individual not found in application cache - than individual will be loaded from database
 * @param {boolean} init individual with class model at load. If true or not set, then individual will be initialized with class specific model upon load.
 */
function IndividualModel(uri, cache, init) {
  // IndividualModel({...})
  if (typeof uri === 'object' && !uri['@']) {
    cache = uri.cache;
    init = uri.init;
    uri = uri.uri;
  }

  // Define Model data
  this._ = {
    cache: typeof cache === 'boolean' ? cache : cache || true,
    init: typeof init !== 'undefined' ? init : true,
    isNew: typeof uri === 'undefined',
    isSync: typeof uri === 'object',
    isLoaded: typeof uri === 'object',
    pending: {},
    uri: uri,
  };

  if (typeof uri === 'object') {
    this.properties = uri;
    this.original = JSON.stringify(uri);
  } else {
    this.properties = {};
  }

  if (this._.cache) {
    let cached;
    if (typeof uri === 'string') {
      this.id = uri;
      cached = veda.cache.get(this.id);
    } else if (typeof uri === 'object') {
      cached = veda.cache.get(this.id);
      if (cached && !cached.isLoaded()) {
        cached.properties = uri;
      }
    } else if (typeof uri === 'undefined') {
      this.id = Util.genUri();
    }
    if (cached) {
      return cached;
    } else {
      veda.cache.set(this, this._.cache);
    }
  }

  riot.observable(this);

  this.on('rdf:type', this.init);
  this.on('beforeSave', beforeSaveHandler);

  return this;
};

/**
 * Save handler. Sets creator & creation date
 * @this IndividualModel
 */
function beforeSaveHandler() {
  const now = new Date();
  const user = veda.appointment ? veda.appointment : veda.user;

  if ( !this.hasValue('v-s:creator') ) {
    this.set('v-s:creator', [user]);
  }
  if ( !this.hasValue('v-s:created') ) {
    this.set('v-s:created', [now]);
  }

  if (veda.user.id === 'cfg:Administrator') {
    return;
  } else if (
    !this.hasValue('v-s:lastEditor') ||
    !this.hasValue('v-s:edited') ||
    this.get('v-s:lastEditor')[0].id !== user.id ||
    (now - this.get('v-s:edited')[0]) > 1000
  ) {
    this.set('v-s:edited', [now]);
    this.set('v-s:lastEditor', [user]);
  }
}

const proto = IndividualModel.prototype;

proto.get = function (property_uri) {
  if (!this.properties[property_uri]) return [];
  return this.properties[property_uri].map(parser).filter((i) => typeof i !== 'undefined');
};

proto.set = function (property_uri, values, silently) {
  this.isSync(false);
  if ( !Array.isArray(values) ) {
    values = [values];
  }
  const serialized = values.map(serializer).filter(Boolean);
  const uniq = unique(serialized);
  if ( JSON.stringify(uniq) !== JSON.stringify(this.properties[property_uri] || []) ) {
    if (uniq.length) {
      this.properties[property_uri] = uniq;
    } else {
      delete this.properties[property_uri];
    }
    if ( !silently ) {
      values = this.get(property_uri);
      this.trigger('propertyModified', property_uri, values);
      this.trigger(property_uri, values);
    }
  }
  return this;
};

/**
 * Utility fn
 * @param {Array} arr
 * @return {Array}
 */
function unique (arr) {
  const n = {}; const r = [];
  for (let i = 0, val; i < arr.length; i++) {
    val = arr[i].type + arr[i].data + (arr[i].lang || '');
    if (!n[val]) {
      n[val] = true;
      r.push(arr[i]);
    }
  }
  return r;
}

// Define properties from ontology in IndividualModel.prototype
IndividualModel.defineProperty = function (property_uri) {
  Object.defineProperty(proto, property_uri, {
    get: function () {
      return this.get(property_uri);
    },
    set: function (values) {
      return this.set(property_uri, values);
    },
    configurable: false,
    enumerable: false,
  });
};

/**
 * Parse serialized value
 * @param {Object} value
 * @return {string|number|Date|Boolean}
 */
function parser(value) {
  if (value.type === 'String' && value.data) {
    const string = new String(value.data);
    if (value.lang && value.lang !== 'NONE') {
      string.language = value.lang;
    }
    return string;
  } else if (value.type === 'Uri') {
    return new IndividualModel(value.data);
  } else if (value.type === 'Datetime') {
    return new Date(Date.parse(value.data));
  } else if (value.type === 'Decimal') {
    return parseFloat(value.data);
  } else if (value.type === 'Integer') {
    return parseInt(value.data);
  } else if (value.type === 'Boolean') {
    return Boolean(value.data);
  }
}

const reg_uri = /^[a-z][a-z-0-9]*:([a-zA-Z0-9-_])*$/;
const reg_date = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const reg_ml_string = /^(.*)@([a-z]{2})$/ims;

/**
 * Serialize value
 * @param {number|Boolean|Date|string|IndividualModel} value
 * @return {Object}
 */
function serializer (value) {
  if (typeof value === 'number' ) {
    return {
      type: Util.isInteger(value) ? 'Integer' : 'Decimal',
      data: value,
    };
  } else if (typeof value === 'boolean') {
    return {
      type: 'Boolean',
      data: value,
    };
  } else if (value instanceof Date) {
    return {
      type: 'Datetime',
      data: value.toISOString(),
    };
  } else if (value instanceof IndividualModel) {
    return {
      type: 'Uri',
      data: value.id,
    };
  } else if (typeof value === 'string' || value instanceof String) {
    if ( reg_uri.test(value) ) {
      return {
        type: 'Uri',
        data: value.valueOf(),
      };
    } else if ( reg_date.test(value) ) {
      return {
        type: 'Datetime',
        data: value.valueOf(),
      };
    } else if ( reg_ml_string.test(value) ) {
      return {
        type: 'String',
        data: value.replace(reg_ml_string, '$1'),
        lang: value.replace(reg_ml_string, '$2').toUpperCase(),
      };
    } else if (value.length) {
      return {
        type: 'String',
        data: value.valueOf(),
        lang: value.language || 'NONE',
      };
    }
  }
}

// Special properties
Object.defineProperty(proto, 'id', {
  get: function () {
    return this.properties['@'];
  },
  set: function (value) {
    const previous = this.properties && this.properties['@'];
    this.properties['@'] = value;
    if (previous && this._.cache && veda.cache.get(previous)) {
      veda.cache.remove(previous);
      veda.cache.set(this, this._.cache);
    }
  },
});

Object.defineProperty(proto, 'membership', {
  get: function () {
    // if (this._.membership) { return Promise.resolve(this._.membership); }
    if (this.isNew()) {
      this._.membership = new IndividualModel({cache: false});
      return Promise.resolve(this._.membership);
    }
    return Backend.get_membership(veda.ticket, this.id)
      .then((membershipJSON) => {
        return this._.membership = new IndividualModel({uri: membershipJSON, cache: false});
      })
      .catch((error) => {
        console.log('membership error', this.id, error);
        return this._.membership = new IndividualModel({cache: false});
      });
  },
  configurable: false,
  enumerable: false,
});

proto.memberOf = function () {
  return this.membership.then((membership) => {
    return membership.hasValue('v-s:memberOf') ? membership.properties['v-s:memberOf'].map((group_item) => group_item.data) : [];
  });
};

proto.isMemberOf = function (group_uri) {
  return this.membership.then((membership) => membership.hasValue('v-s:memberOf', group_uri));
};

Object.defineProperty(proto, 'rights', {
  get: function () {
    // if (this._.rights) { return Promise.resolve(this._.rights); }
    if (this.isNew()) {
      this._.rights = new IndividualModel({cache: false});
      this._.rights['v-s:canCreate'] = [true];
      this._.rights['v-s:canRead'] = [true];
      this._.rights['v-s:canUpdate'] = [true];
      this._.rights['v-s:canDelete'] = [true];
      return Promise.resolve(this._.rights);
    }
    return Backend.get_rights(veda.ticket, this.id).then((rightsJSON) => {
      return this._.rights = new IndividualModel(rightsJSON, false);
    }).catch((error) => {
      console.log('rights error', this.id, error);
      return this._.rights = new IndividualModel({cache: false});
    });
  },
  configurable: false,
  enumerable: false,
});

proto.can = function (action) {
  action = action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
  return this.rights.then((rights) => rights.hasValue('v-s:can' + action, true));
};
proto.canCreate = function () {
  return this.can('Create');
};
proto.canRead = function () {
  return this.can('Read');
};
proto.canUpdate = function () {
  return this.can('Update');
};
proto.canDelete = function () {
  return this.can('Delete');
};

Object.defineProperty(proto, 'rightsOrigin', {
  get: function () {
    // if (this._.rightsOrigin) { return Promise.resolve(this._.rightsOrigin); }
    return Backend.get_rights_origin(veda.ticket, this.id).then((rightsOriginArr) => {
      return this._.rightsOrigin = Promise.all(rightsOriginArr.map((item) => {
        return new IndividualModel(item, false);
      }));
    }).catch((error) => {
      console.log('rights error', this.id, error);
      return this._.rightsOrigin = [];
    });
  },
  configurable: false,
  enumerable: false,
});

/**
 * Load individual specified by uri from database. If cache parameter (from constructor) is true, than try to load individual from browser cache first.
 * @return {Promise<IndividualModel>}
 */
proto.load = function () {
  if ( this.isLoading() && typeof window !== 'undefined' ) {
    return this.isLoading();
  }
  return this.trigger('beforeLoad').then(() => {
    if ( this.isLoaded() && ( Backend.status === 'online' || Backend.status === 'offline' ) ) {
      return this.trigger('afterLoad');
    } else if ( this.isLoaded() && Backend.status === 'limited' ) {
      if (typeof window !== 'undefined') {
        return this.is('v-s:UserThing').then((isUserThing) => {
          if (isUserThing) {
            return this.reset();
          } else {
            return this;
          }
        }).then(() => {
          return this.trigger('afterLoad');
        });
      } else {
        return this.reset()
          .then(() => {
            return this.trigger('afterLoad');
          });
      }
    }
    const uri = this._.uri;
    if (typeof uri === 'string') {
      const loadingPromise = Backend.get_individual(veda.ticket, uri).then((individualJson) => {
        this.isLoading(false);
        this.isNew(false);
        this.isSync(true);
        this.isLoaded(true);
        this.properties = individualJson;
        this.original = JSON.stringify(individualJson);
        return (this._.init ? this.init() : Promise.resolve(this))
          .then(() => this.trigger('afterLoad'));
      }).catch((error) => {
        this.isLoading(false);
        console.log('load individual error', this.id, error.stack);
        if (error.code === 422 || error.code === 404) {
          this.isNew(true);
          this.isSync(false);
          this.isLoaded(false);
          this.properties = {
            '@': uri,
            'rdf:type': [{type: 'Uri', data: 'rdfs:Resource'}],
            'rdfs:label': [
              {type: 'String', data: 'Объект не существует [' + uri + ']', lang: 'RU'},
              {type: 'String', data: 'Object does not exist [' + uri + ']', lang: 'EN'},
            ],
          };
        } else if (error.code === 472) {
          this.isNew(false);
          this.isSync(false);
          this.isLoaded(false);
          this.properties = {
            '@': uri,
            'rdf:type': [{type: 'Uri', data: 'rdfs:Resource'}],
            'rdfs:label': [
              {type: 'String', data: 'Нет прав на объект', lang: 'RU'},
              {type: 'String', data: 'Insufficient rights', lang: 'EN'},
            ],
          };
        } else if (error.code === 470 || error.code === 471) {
          this.isNew(false);
          this.isSync(false);
          this.isLoaded(false);
        } else if (error.code === 0 || error.code === 4000 || error.code === 503) {
          this.isNew(false);
          this.isSync(false);
          this.isLoaded(false);
          this.properties = {
            '@': uri,
            'rdf:type': [{type: 'Uri', data: 'rdfs:Resource'}],
            'rdfs:label': [
              {type: 'String', data: 'Нет связи с сервером. Этот объект сейчас недоступен.', lang: 'RU'},
              {type: 'String', data: 'Server disconnected. This object is not available now.', lang: 'EN'},
            ],
          };
          veda.one('online', () => this.reset());
        } else {
          this.isNew(false);
          this.isSync(false);
          this.isLoaded(false);
          this.properties = {
            '@': uri,
            'rdf:type': [{type: 'Uri', data: 'rdfs:Resource'}],
            'rdfs:label': [{type: 'String', data: uri, lang: 'NONE'}],
          };
        }
        return this.trigger('afterLoad');
      });
      return this.isLoading(loadingPromise);
    } else if (typeof uri === 'object') {
      this.isNew(false);
      this.isSync(true);
      this.isLoaded(true);
      this.properties = uri;
    } else if (typeof uri === 'undefined') {
      this.isNew(true);
      this.isSync(false);
      this.isLoaded(false);
    }
    return (this._.init ? this.init() : Promise.resolve(this))
      .then(() => this.trigger('afterLoad'));
  });
};

/**
 * Save current individual to database
 * @param {boolean} isAtomic
 * @return {Promise<IndividualModel>}
 */
proto.save = function(isAtomic) {
  // Do not save individual to server if nothing changed
  if (this.isSync()) {
    return Promise.resolve(this);
  }
  if ( this.isSaving() && this.isSync() && typeof window !== 'undefined' ) {
    return this.isSaving();
  }
  if (isAtomic == undefined) isAtomic = true;
  return this.trigger('beforeSave').then(() => {
    Object.keys(this.properties).reduce((acc, property_uri) => {
      if (property_uri === '@') return acc;
      if (!acc[property_uri].length) delete acc[property_uri];
      return acc;
    }, this.properties);

    const original = this.original ? JSON.parse(this.original) : {'@': this.id};
    const delta = Util.diff(this.properties, original);

    const promise = (this.isNew() || isAtomic ?
      Backend.put_individual(veda.ticket, this.properties) :
      Promise.all([
        delta.added && Object.keys(delta.added).length ? (delta.added['@'] = this.id, Backend.add_to_individual(veda.ticket, delta.added)) : undefined,
        delta.differ && Object.keys(delta.differ).length ? (delta.differ['@'] = this.id, Backend.set_in_individual(veda.ticket, delta.differ)) : undefined,
        delta.missing && Object.keys(delta.missing).length? (delta.missing['@'] = this.id, Backend.remove_from_individual(veda.ticket, delta.missing)) : undefined,
      ])
    ).then(() => {
      this.original = JSON.stringify(this.properties);
      this.isSaving(false);
      this.isNew(false);
      this.isSync(true);
      this.isLoaded(true);
      return this.trigger('afterSave');
    }).catch((error) => {
      this.isSaving(false);
      console.log('save individual error', this.id, error);
      throw error;
    });
    return this.isSaving(promise);
  });
};

/**
 * Reset current individual to database
 * @param {Object} original
 * @return {Promise<IndividualModel>}
 */
proto.reset = function (original) {
  /**
   * Merge original from DB with local changes
   * @param {Object} original
   * @return {void}
   */
  const processOriginal = (original) => {
    this.original = JSON.stringify(original);
    const this_property_uris = Object.keys(this.properties);
    const original_property_uris = Object.keys(original);
    const union = Util.unique( this_property_uris.concat(original_property_uris) );
    union.forEach((property_uri) => {
      let modified = false;
      if (property_uri === '@') {
        return;
      }
      if (!this.properties[property_uri]) {
        this.properties[property_uri] = original[property_uri];
        modified = true;
      } else if (!original[property_uri]) {
        delete this.properties[property_uri];
        modified = true;
      } else {
        const currentSum = JSON.stringify(this.properties[property_uri]).split('').reduce(function (acc, char) {
          return acc += char.charCodeAt(0);
        }, 0);
        const originalSum = JSON.stringify(original[property_uri]).split('').reduce(function (acc, char) {
          return acc += char.charCodeAt(0);
        }, 0);
        if (currentSum !== originalSum) {
          this.properties[property_uri] = original[property_uri];
          modified = true;
        }
      }
      if (modified) {
        const values = this.get(property_uri);
        this.trigger('propertyModified', property_uri, values);
        this.trigger(property_uri, values);
      }
    });
  };

  if ( this.isResetting() && typeof window !== 'undefined' ) {
    return this.isResetting();
  }
  return this.trigger('beforeReset').then(() => {
    if (this.isNew()) {
      return this.trigger('afterReset');
    }
    const promise = (original ? Promise.resove(original) : Backend.reset_individual(veda.ticket, this.id))
      .then(processOriginal)
      .then(() => {
        this.isResetting(false);
        this.isNew(false);
        this.isSync(true);
        this.isLoaded(true);
        return this.trigger('afterReset');
      })
      .catch((error) => {
        this.isResetting(false);
        console.log('reset individual error', this.id, error);
        throw error;
      });
    return this.isResetting(promise);
  });
};

/**
 * Mark current individual as deleted in database (set v-s:deleted = true)
 * @return {Promise<IndividualModel>}
 */
proto.delete = function () {
  return this.trigger('beforeDelete').then(() => {
    if ( this.isNew() ) {
      return this.trigger('afterDelete');
    }
    this['v-s:deleted'] = [true];
    return this.save();
  }).then(() => this.trigger('afterDelete'));
};

/**
 * Remove individual from database
 * @return {Promise<IndividualModel>}
 */
proto.remove = function () {
  return this.trigger('beforeRemove').then(() => {
    if ( this._.cache && veda.cache && veda.cache.get(this.id) ) {
      veda.cache.remove(this.id);
    }
    if ( this.isNew() ) {
      return this.trigger('afterRemove');
    }
    return Backend.remove_individual(veda.ticket, this.id);
  }).then(() => this.trigger('afterRemove'));
};

/**
 * Recover current individual in database (remove v-s:deleted property)
 * @return {Promise<IndividualModel>}
 */
proto.recover = function () {
  return this.trigger('beforeRecover').then(() => {
    this['v-s:deleted'] = [];
    return this.save();
  }).then(() => this.trigger('afterRecover'));
};

/**
 * Check if individual has a property and optionally check if it contains a value
 * @param {String} property_uri property name
 * @param {Object} value to check
 * @return {boolean} is requested property (and optionally value) exists in this individual
 */
proto.hasValue = function (property_uri, value) {
  if (!property_uri && typeof value !== 'undefined' && value !== null) {
    let found = false;
    for (const property_uri in this.properties) {
      if (property_uri === '@') {
        continue;
      }
      found = found || this.hasValue(property_uri, value);
    }
    return found;
  }
  let result = !!(this.properties[property_uri] && this.properties[property_uri].length);
  if (typeof value !== 'undefined' && value !== null) {
    const serialized = serializer(value);
    result = result && !!this.properties[property_uri].filter( function (item) {
      return ( item.type === serialized.type && item.data === serialized.data && (item.lang && serialized.lang ? item.lang === serialized.lang : true) );
    }).length;
  }
  return result;
};

/**
 * Add value to individual
 * @param {String} property_uri property name
 * @param {Any_allowed_type} values
 * @param {Boolean} silently
 * @return {IndividualModel}
 */
proto.addValue = function (property_uri, values, silently) {
  if (typeof values === 'undefined' || values === null) {
    return this;
  }
  this.properties[property_uri] = this.properties[property_uri] || [];
  if ( Array.isArray(values) ) {
    values.forEach((value) => addSingleValue.call(this, property_uri, value));
  } else {
    addSingleValue.call(this, property_uri, values);
  }
  this.isSync(false);
  if ( !silently ) {
    values = this.get(property_uri);
    this.trigger('propertyModified', property_uri, values);
    this.trigger(property_uri, values);
  }
  return this;
};

/**
 * Add value to individual
 * @param {String} property_uri property name
 * @param {Any_allowed_type} value
 * @return {void}
 * @this IndividualModel
 */
function addSingleValue(property_uri, value) {
  if (value != undefined) {
    const serialized = serializer(value);
    this.properties[property_uri].push(serialized);
  }
}

/**
 * Remove value from individual
 * @param {String} property_uri property name
 * @param {Any_allowed_type} values
 * @param {Boolean} silently
 * @return {IndividualModel}
 */
proto.removeValue = function (property_uri, values, silently) {
  if (!this.properties[property_uri] || !this.properties[property_uri].length || typeof values === 'undefined' || values === null) {
    return this;
  }
  if ( Array.isArray(values) ) {
    values.forEach((value) => removeSingleValue.call(this, property_uri, value));
  } else {
    removeSingleValue.call(this, property_uri, values);
  }
  this.isSync(false);
  if ( !silently ) {
    values = this.get(property_uri);
    this.trigger('propertyModified', property_uri, values);
    this.trigger(property_uri, values);
  }
  return this;
};

/**
 * Remove value from individual
 * @param {String} property_uri property name
 * @param {Any_allowed_type} value
 * @this {IndividualModel}
 * @return {void}
 */
function removeSingleValue (property_uri, value) {
  if (value != undefined) {
    const serialized = serializer(value);
    this.properties[property_uri] = (this.properties[property_uri] || []).filter(function (item) {
      return !( item.data == serialized.data && (item.lang && serialized.lang ? item.lang === serialized.lang : true) );
    });
  }
}

/**
 * Toggle value in individual
 * @param {String} property_uri
 * @param {Any_allowed_type} values
 * @param {Boolean} silently
 * @return {this}
 */
proto.toggleValue = function (property_uri, values, silently) {
  if (typeof values === 'undefined' || values === null) {
    return this;
  }
  this.properties[property_uri] = this.properties[property_uri] || [];
  if ( Array.isArray(values) ) {
    values.forEach((value) => toggleSingleValue.call(this, property_uri, value));
  } else {
    toggleSingleValue.call(this, property_uri, values);
  }
  this.isSync(false);
  if ( !silently ) {
    values = this.get(property_uri);
    this.trigger('propertyModified', property_uri, values);
    this.trigger(property_uri, values);
  }
  return this;
};

/**
 * Toggle value in individual
 * @param {String} property_uri
 * @param {Any_allowed_type} value
 * @this IndividualModel
 */
function toggleSingleValue (property_uri, value) {
  if (value != undefined) {
    if ( this.hasValue(property_uri, value) ) {
      removeSingleValue.call(this, property_uri, value);
    } else {
      addSingleValue.call(this, property_uri, value);
    }
  }
}

/**
 * Clear property values in individual
 * @param {String} property_uri
 * @param {Boolean} silently
 * @return {this}
 */
proto.clearValue = function (property_uri, silently) {
  if (!this.properties[property_uri] || !this.properties[property_uri].length) {
    return this;
  } else {
    delete this.properties[property_uri];
    this.isSync(false);
    if ( !silently ) {
      const empty = [];
      this.trigger('propertyModified', property_uri, empty);
      this.trigger(property_uri, empty);
    }
  }
  return this;
};

/**
 * Check if individual is an instace of specific class
 * @param {String} _class id of class to check
 * @return {boolean} is individual rdf:type subclass of requested class
 */
proto.is = function (_class) {
  const isSub = function (type) {
    if (is) {
      return is;
    }
    if (!type.hasValue('rdfs:subClassOf')) {
      return (is = is || false);
    } else if (type.hasValue('rdfs:subClassOf', _class.id)) {
      return (is = is || true);
    } else {
      const types = type.get('rdfs:subClassOf');
      return Promise.all(types.map(isSub)).then(function (results) {
        return results.reduce((state, isSub) => state || isSub, false);
      });
    }
  };

  if (typeof _class.valueOf() === 'string') {
    _class = new IndividualModel( _class.valueOf() );
  }
  const types = this.get('rdf:type');
  let is = types.reduce((state, type) => state || this.hasValue('rdf:type', _class.id), false);
  if (is) {
    return Promise.resolve(is);
  } else {
    return Promise.all(types.map(isSub)).then((results) => {
      return results.reduce((state, isSub) => state || isSub, false);
    });
  }
};

/**
 * Initialize individual with class specific domain properties and methods
 * @return {Promise<IndividualModel>}
 */
proto.init = function () {
  const isClass = this.hasValue('rdf:type', 'owl:Class') || this.hasValue('rdf:type', 'rdfs:Class');
  if ( this.hasValue('v-ui:hasModel') && !isClass ) {
    return this.get('v-ui:hasModel')[0].load()
      .then((model) => {
        if ( !model.modelFn ) {
          model.modelFn = new Function('veda', model['v-s:script'][0]);
        }
        model.modelFn.call(this, veda);
        return this;
      });
  } else {
    const types_promises = this.get('rdf:type').map((type_promise) => {
      return type_promise.load();
    });
    return Promise.all( types_promises )
      .then((types) => {
        const models_promises = [];
        types.map((type) => {
          if ( type.hasValue('v-ui:hasModel') ) {
            models_promises.push( type.get('v-ui:hasModel')[0].load() );
          }
        });
        return Promise.all( models_promises );
      })
      .then((models) => {
        models.map((model) => {
          if ( !model.modelFn ) {
            model.modelFn = new Function('veda', model.get('v-s:script')[0]);
          }
          model.modelFn.call(this, veda);
        });
        return this;
      });
  }
};

/**
 * Clone individual with different (generated) id
 * @return {Promise<IndividualModel>} clone of this individual with different id.
 */
proto.clone = function () {
  const cloneProperties = JSON.parse( JSON.stringify(this.properties) );
  cloneProperties['@'] = Util.genUri();
  const clone = new IndividualModel(cloneProperties);
  clone.isNew(true);
  clone.isSync(false);
  clone.clearValue('v-s:updateCounter');
  return clone.init();
};

/**
 * Set/get flag whether individual is synchronized with db
 * @param {boolean} value
 * @return {boolean}
 */
proto.isSync = function (value) {
  return ( typeof value !== 'undefined' ? this._.isSync = value : this._.isSync );
};

/**
 * Set/get flag whether individual is new (not saved in db)
 * @param {boolean} value
 * @return {boolean}
 */
proto.isNew = function (value) {
  return ( typeof value !== 'undefined' ? this._.isNew = value : this._.isNew );
};

/**
 * Set/get flag whether individual was loaded from db
 * @param {boolean} value
 * @return {boolean}
 */
proto.isLoaded = function (value) {
  return ( typeof value !== 'undefined' ? this._.isLoaded = value : this._.isLoaded );
};

proto.isPending = function(operation, value) {
  return ( typeof value !== 'undefined' ? this._.pending[operation] = value : this._.pending[operation] );
};

proto.isLoading = function (value) {
  return this.isPending('load', value);
};
proto.isSaving = function (value) {
  return this.isPending('save', value);
};
proto.isResetting = function (value) {
  return this.isPending('reset', value);
};

/**
 * Serialize to JSON
 * @return {Object} JSON representation of individual.
 */
proto.toJson = function () {
  return this.properties;
};

/**
 * Serialize to string
 * @return {String} String representation of individual.
 */
proto.toString = function () {
  return this.hasValue('rdfs:label') ? this.get('rdfs:label').map(Util.formatValue).join(' ') : this.hasValue('rdf:type') ? this.get('rdf:type')[0].toString() + ': ' + this.id : this.id;
};

/**
 * Return this
 * @return {String} individual id.
 */
proto.valueOf = function () {
  return this.id;
};

/**
 * Get values for first property chain branch.
 * @return {Promise<Array>}
 */
proto.getPropertyChain = function (...args) {
  const property_uri = args.shift();
  return this.load().then(() => {
    if ( this.hasValue(property_uri) ) {
      if ( !args.length ) {
        return this[property_uri];
      } else {
        return this.getPropertyChain.apply(this[property_uri][0], args);
      }
    }
    return [];
  }).catch((error) => {
    console.log(error);
  });
};

/**
 * Get values for all property chain branches.
 * @return {Promise<Array>}
 */
proto.getChainValue = function (...properties) {
  let individuals = this;
  if ( !Array.isArray(individuals) ) {
    individuals = [individuals];
  }
  const property_uri = properties.shift();
  const promises = individuals.map(function (individual) {
    return individual.load();
  });
  return Promise.all(promises).then(function (individuals) {
    const children = individuals.reduce(function (acc, individual) {
      return acc.concat(individual.get(property_uri));
    }, []);
    if ( !properties.length ) {
      return children;
    } else {
      return proto.getChainValue.apply(children, properties);
    }
  }).catch(function (error) {
    console.log(error);
    return [];
  });
};

/**
 * Check value for all property chain branches.
 * @param {string} sought_value
 * @param {...string} ...args
 * @return {Promise<Boolean>}
 */
proto.hasChainValue = function (sought_value, ...args) {
  return this.getChainValue(...args).then(function (values) {
    return values.reduce(function (state, value) {
      return state || sought_value.valueOf() == value.valueOf();
    }, false);
  });
};

/**
 * Prefetch linked objects. Useful for presenting objects with many links.
 * @param {number} depth of the object tree to prefetch.
 * @return {Promise}
 */
proto.prefetch = function (depth, ...allowed_props) {
  depth = depth || 1;
  return this.load().then(() => {
    return prefetch.apply(this, [[], depth, [this.id]].concat(allowed_props) );
  });
};

/**
 * Prefetch linked objects. Useful for presenting objects with many links.
 * @param {Array} result
 * @param {number} depth of the object tree to prefetch
 * @param {Array} uris
 * @return {Promise}
 * @this IndividualModel
 */
function prefetch(result, depth, uris, ...allowed_props) {
  uris = Util.unique( uris );
  const toGet = uris.filter((uri) => {
    const cached = veda.cache.get(uri);
    if ( cached && result.indexOf(cached) < 0 ) {
      result.push(cached);
    }
    return !cached;
  });
  return (toGet.length ? Backend.get_individuals(veda.ticket, toGet) : Promise.resolve([])).then((got) => {
    const nextUris = [];
    got.forEach((json) => {
      if (json) {
        const individual = new IndividualModel(json);
        if ( result.indexOf(individual) < 0 ) {
          result.push(individual);
        }
      }
    });
    if (depth - 1 === 0) {
      return result;
    }
    uris.forEach((uri) => {
      const individual = new IndividualModel(uri);
      const data = individual.properties;
      Object.keys(data).forEach( function (key) {
        if ( key === '@' || (allowed_props.length && allowed_props.indexOf(key) < 0) ) {
          return;
        }
        data[key].map(function (value) {
          if (value.type === 'Uri') {
            nextUris.push(value.data);
          }
        });
      });
    });
    if (!nextUris.length) {
      return result;
    }
    return prefetch.apply(this, [result, depth-1, nextUris].concat(allowed_props) );
  });
}
