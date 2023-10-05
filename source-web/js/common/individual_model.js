/**
 * Individual Model
 * @module IndividualModel
 */

import veda from '../common/veda.js';
import riot from '../common/lib/riot.js';
import Backend from '../common/backend.js';
import UpdateService from '../browser/update_service.js';
import WeakCache from '../common/weak_cache.js';
import Util from '../common/util.js';

export default IndividualModel;

// Create an instance of UpdateService if running in a browser
let updateService;
if (typeof window !== 'undefined') {
  updateService = new UpdateService();
  updateService.start();
}

// Create a weak cache for IndividualModel instances
IndividualModel.cache = new WeakCache();

/**
 * Represents an individual in the system.
 *
 * @constructor
 * @param {string|object|undefined} uri - The URI of the individual or an object with additional parameters.
 * @param {boolean} [cache=true] - Indicates if the individual should be cached.
 * @param {boolean} [init=true] - Indicates if the individual should be initialized with the class specific model upon load.
 */
function IndividualModel (uri, cache = true, init = true) {
  if (typeof uri === 'object' && !uri['@']) {
    // Parse parameters if uri is passed as an object
    cache = uri.cache;
    init = uri.init;
    uri = uri.uri;
  }

  // Define Model data
  this._ = {cache, init};
  this.removedObjs = [];

  if (typeof uri === 'object') {
    // Initialize model with uri object parameters
    this.properties = Object.assign({}, uri);
    this.original = JSON.stringify(this.properties);
    this.isNew(false);
    this.isLoaded(true);
    this.isSync(true);
  } else if (typeof uri === 'string') {
    // Initialize model with URI
    this.properties = {};
    this.original = JSON.stringify(this.properties);
    this.id = uri;
    this.isNew(false);
    this.isLoaded(false);
    this.isSync(false);
  } else if (typeof uri === 'undefined') {
    // Generate a new URI if uri is not specified
    this.properties = {};
    this.original = JSON.stringify(this.properties);
    this.id = Util.genUri();
    this.isNew(true);
    this.isLoaded(false);
    this.isSync(false);
  }

  if (cache) {
    const cached = IndividualModel.cache.get(this.id);
    if (cached) {
      if (typeof uri === 'object') {
        // Use a cached model if possible
        cached._ = this._;
        cached.properties = this.properties;
        cached.original = this.original;
      }
      return cached;
    } else {
      IndividualModel.cache.set(this.id, this);
    }
  }

  riot.observable(this);
  this.on('rdf:type', this.init);
  this.on('beforeSave', beforeSaveHandler);
  return this;
}

/**
 * Save handler. Sets creator & creation date
 * @this IndividualModel
 */
function beforeSaveHandler () {
  const now = new Date();
  const user = veda.appointment ? veda.appointment : veda.user;

  if (!this.hasValue('v-s:creator')) {
    this.set('v-s:creator', [user]);
  }
  if (!this.hasValue('v-s:created')) {
    this.set('v-s:created', [now]);
  }

  if (veda.user.id === 'cfg:Administrator') {
    return;
  } else if (
    !this.hasValue('v-s:lastEditor') ||
    !this.hasValue('v-s:edited') ||
    this.get('v-s:lastEditor')[0].id !== user.id ||
    now - this.get('v-s:edited')[0] > 1000
  ) {
    this.set('v-s:edited', [now]);
    this.set('v-s:lastEditor', [user]);
  }
}

const proto = IndividualModel.prototype;

/**
 * Get property values for the specified property URI
 * @param {string} property_uri - The URI of the property
 * @return {Array} - Array of property values
 */
proto.get = function (property_uri) {
  if (!this.properties[property_uri]) return [];
  return this.properties[property_uri].map(parser).filter((i) => typeof i !== 'undefined');
};

/**
 * Set property values for the specified property URI
 * @param {string} property_uri - The URI of the property
 * @param {Array|Any_allowed_type} values - The values to set for the property
 * @param {boolean} [silently] - Indicates whether to trigger propertyModified and property events
 * @return {Promise<IndividualModel>} - Promise that resolves to the current IndividualModel instance
 */
proto.set = function (property_uri, values, silently) {
  if (!Array.isArray(values)) {
    values = [values];
  }
  const serialized = values.map(serializer).filter(Boolean);
  const uniq = unique(serialized);
  const prevValues = this.properties[property_uri] === undefined ? [] : this.properties[property_uri];
  let isChanged = false;
  if (uniq.length !== prevValues.length) {
    isChanged = true;
  } else {
    for (const value of uniq) {
      const isExist = prevValues.some(function (prevValue) {
        return prevValue.data === value.data && prevValue.type === value.type;
      });
      if (!isExist) {
        isChanged = true;
        break;
      }
    }
  }
  if (isChanged) {
    this.isSync(false);
    if (uniq.length) {
      this.properties[property_uri] = uniq;
    } else {
      delete this.properties[property_uri];
    }
    if (!silently) {
      values = this.get(property_uri);
      return this.trigger('propertyModified', property_uri, values)
        .then(() => this.trigger(property_uri, values));
    }
  }
  return Promise.resolve(this);
};

/**
 * Utility function to return unique values from an array
 * @param {Array} arr - The input array
 * @return {Array} - The array with unique values
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
      this.set(property_uri, values);
    },
    configurable: false,
    enumerable: false,
  });
};

/**
 * Parse serialized value
 * @param {Object} value - The serialized value to parse
 * @return {string|number|Date|boolean} - The parsed value
 */
function parser (value) {
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

// Define helper regular expressions for property serialization
const reg_uri = /^[a-z][a-z-0-9]*:([a-zA-Z0-9-_\.])*$/;
const reg_date = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const reg_ml_string = /^(.*)\^([a-z]{2})$/ims;
const reg_round_decimal = /^-?\d+([\.\,])0$/;

/**
 * Serialize value
 * @param {number|boolean|Date|string|IndividualModel} value - The value to serialize
 * @return {Object} - The serialized value
 */
function serializer (value) {
  if (typeof value === 'number') {
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
      data: value.toISOString().split('.')[0] + 'Z',
    };
  } else if (value instanceof IndividualModel) {
    return {
      type: 'Uri',
      data: value.id,
    };
  } else if (typeof value === 'string' || value instanceof String) {
    if (reg_uri.test(value)) {
      return {
        type: 'Uri',
        data: value.valueOf(),
      };
    } else if (reg_date.test(value)) {
      return {
        type: 'Datetime',
        data: value.valueOf(),
      };
    } else if (reg_ml_string.test(value)) {
      return {
        type: 'String',
        data: value.replace(reg_ml_string, '$1'),
        lang: value.replace(reg_ml_string, '$2').toUpperCase(),
      };
    } else if (reg_round_decimal.test(value)) {
      return {
        type: 'Decimal',
        data: parseFloat(value),
      };
    } else if (value.length) {
      return {
        type: 'String',
        data: value.valueOf(),
        ...(value.language && {lang: value.language}),
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
    if (previous && this._.cache && IndividualModel.cache.get(previous)) {
      IndividualModel.cache.delete(previous);
      IndividualModel.cache.set(this.id, this);
    }
  },
});

Object.defineProperty(proto, 'membership', {
  get: function () {
    if (this.isNew()) {
      this._.membership = new IndividualModel({cache: false});
      return Promise.resolve(this._.membership);
    }
    return Backend.get_membership(veda.ticket, this.id)
      .then((membershipJSON) => {
        this._.membership = new IndividualModel({uri: membershipJSON, cache: false});
        return this._.membership;
      })
      .catch((error) => {
        console.error('Membership failed', this.id);
        this._.membership = new IndividualModel({cache: false});
        return this._.membership;
      });
  },
  configurable: false,
  enumerable: false,
});

/**
 * Get the member groups of the individual
 * @memberof IndividualModel.prototype
 * @return {Promise<Array<string>>} - Promise that resolves to an array of group URIs
 */
proto.memberOf = function () {
  return this.membership.then((membership) => {
    return membership.hasValue('v-s:memberOf') ?
      membership.properties['v-s:memberOf'].map((group_item) => group_item.data) :
      [];
  });
};

/**
 * Check if the individual is a member of a specific group
 * @memberof IndividualModel.prototype
 * @param {string} group_uri - The URI of the group
 * @return {Promise<boolean>} - Promise that resolves to a boolean value indicating if the individual is a member of the group
 */
proto.isMemberOf = function (group_uri) {
  return this.membership.then((membership) =>
    membership.hasValue('v-s:memberOf', group_uri),
  );
};

Object.defineProperty(proto, 'rights', {
  get: function () {
    if (this.isNew()) {
      this._.rights = new IndividualModel({cache: false});
      this._.rights['v-s:canCreate'] = [true];
      this._.rights['v-s:canRead'] = [true];
      this._.rights['v-s:canUpdate'] = [true];
      this._.rights['v-s:canDelete'] = [true];
      return Promise.resolve(this._.rights);
    }
    return Backend.get_rights(veda.ticket, this.id).then((rightsJSON) => {
      this._.rights = new IndividualModel(rightsJSON, false);
      return this._.rights;
    }).catch((error) => {
      console.error('Rights failed', this.id);
      this._.rights = new IndividualModel({cache: false});
      return this._.rights;
    });
  },
  configurable: false,
  enumerable: false,
});

/**
 * Check if the current user has a specific rights action for this individual.
 * @memberof IndividualModel.prototype
 * @function can
 * @param {string} action - The action to check (e.g., 'Create', 'Read', 'Update', 'Delete')
 * @return {Promise<boolean>} - Promise that resolves to a boolean value indicating if the current user has the specified rights action for this individual.
 */
proto.can = function (action) {
  action = action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
  return this.rights.then((rights) =>
    rights.hasValue('v-s:can' + action, true),
  );
};

/**
 * Check if the current user has the rights to create new instances of the individual (relevant only for class individuals).
 * @memberof IndividualModel.prototype
 * @function canCreate
 * @return {Promise<boolean>} - Promise that resolves to a boolean value indicating if the current user can create new instances of this individual (class).
 */
proto.canCreate = function () {
  return this.can('Create');
};

/**
 * Check if the current user has the rights to read this individual.
 * @memberof IndividualModel.prototype
 * @function canRead
 * @return {Promise<boolean>} - Promise that resolves to a boolean value indicating if the current user can read this individual.
 */
proto.canRead = function () {
  return this.can('Read');
};

/**
 * Check if the current user has the rights to update this individual.
 * @memberof IndividualModel.prototype
 * @function canUpdate
 * @return {Promise<boolean>} - Promise that resolves to a boolean value indicating if the current user can update this individual.
 */
proto.canUpdate = function () {
  return this.can('Update');
};

/**
 * Check if the current user has the rights to delete this individual.
 * @memberof IndividualModel.prototype
 * @function canDelete
 * @return {Promise<boolean>} - Promise that resolves to a boolean value indicating if the current user can delete this individual.
 */
proto.canDelete = function () {
  return this.can('Delete');
};

Object.defineProperty(proto, 'rightsOrigin', {
  get: function () {
    return Backend.get_rights_origin(veda.ticket, this.id)
      .then((rightsOriginArr) => {
        this._.rightsOrigin = Promise.all(rightsOriginArr.map((item) => {
          return new IndividualModel(item, false);
        }));
        return this._.rightsOrigin;
      })
      .catch((error) => {
        console.error('Rights failed', this.id);
        this._.rightsOrigin = [];
        return this._.rightsOrigin;
      });
  },
  configurable: false,
  enumerable: false,
});

/**
 * Watch changes to the individual on the server
 * @memberof IndividualModel.prototype
 * @return {void}
 */
proto.watch = function () {
  if (!updateService) return;
  updateService.subscribe(this, [this.id, this.get('v-s:updateCounter')[0], updater]);
};

/**
 * Callback function for the update service
 * @param {string} id - The ID of the updated individual
 * @param {string} updateCounter - The update counter of the individual
 * @return {void}
 */
function updater (id, updateCounter) {
  const individual = new IndividualModel(id);
  individual.reset().catch(() => {});
}

/**
 * Unwatch changes to the individual on the server
 * @memberof IndividualModel.prototype
 * @return {void}
 */
proto.unwatch = function () {
  if (!updateService) return;
  updateService.unsubscribe(this.id);
};

/**
 * Load the individual data specified by URI from the backend
 * @memberof IndividualModel.prototype
 * @return {Promise<IndividualModel>} - Promise that resolves to the current IndividualModel instance
 */
proto.load = function () {
  if (this.isLoading() && typeof window !== 'undefined') {
    return this.isLoading();
  }
  return this.isLoading(
    this.trigger('beforeLoad')
      .then(() => {
        if (this.isNew() || (this.isLoaded() && (veda.status === 'online' || veda.status === 'offline' || !veda.status))) {
          return this;
        } else if (this.isLoaded() && veda.status === 'limited') {
          return this.reset();
        } else {
          return Backend.get_individual(veda.ticket, this.id).then((data) => {
            this.isSync(true);
            this.isLoaded(true);
            this.properties = data;
            this.original = JSON.stringify(data);
          });
        }
      })
      .then(() => this.init())
      .then(() => this.trigger('afterLoad'))
      .then(() => {
        this.isLoading(false);
        this.watch();
        return this;
      })
      .catch((error) => {
        console.error('Load individual failed', this.id);
        this.isLoading(false);
        throw error;
      }),
  );
};

/**
 * Save the current individual data to the backend
 * @memberof IndividualModel.prototype
 * @param {boolean} [isAtomic=true] - Indicates whether to perform an atomic save
 * @return {Promise<IndividualModel>} - Promise that resolves to the current IndividualModel instance
 */
proto.save = function (isAtomic = true) {
  if (this.isSync()) {
    return Promise.resolve(this);
  }
  if (this.isSaving() && this.isSync() && typeof window !== 'undefined') {
    return this.isSaving();
  }
  return this.isSaving(
    this.trigger('beforeSave')
      .then(() => {
        // Remove empty properties
        this.properties = Object.entries(this.properties).reduce(
          (acc, [property, values]) => {
            if (property === '@') return acc;
            if (values.length) acc[property] = values;
            return acc;
          },
          {},
        );

        const original = this.original ? JSON.parse(this.original) : {'@': this.id};
        const delta = Util.diff(this.properties, original);

        return this.isNew() || isAtomic ?
          Backend.put_individual(veda.ticket, this.properties) :
          Promise.all([
            delta.added &&
                Object.keys(delta.added).length &&
                (delta.added['@'] = this.id,
                Backend.add_to_individual(veda.ticket, delta.added)),
            delta.differ &&
                Object.keys(delta.differ).length &&
                (delta.differ['@'] = this.id,
                Backend.set_in_individual(veda.ticket, delta.differ)),
            delta.missing &&
                Object.keys(delta.missing).length &&
                (delta.missing['@'] = this.id,
                Backend.remove_from_individual(veda.ticket, delta.missing)),
          ])
            .then(() => {
              this.original = JSON.stringify(this.properties);
              this.isNew(false);
              this.isSync(true);
              this.isLoaded(true);
            });
      })
      .then(() => this.trigger('afterSave'))
      .then(() => {
        this.isSaving(false);
        this.watch();
        return this;
      })
      .catch((error) => {
        console.error('Save individual failed', this.id);
        this.isSaving(false);
        throw error;
      }),
  );
};

/**
 * Save individual tree to backend
 * @param {IndividualModel} parent
 * @param {Array} acc
 * @param {WeakSet} visited
 * @return {Promise<IndividualModel>}
 */
proto.saveAll = function (parent, acc, visited) {
  acc = acc || [];
  visited = visited || new WeakSet();
  const toBeSaved = this.isNew() || this.isLoaded() && !this.isSync() && !this.hasValue('rdf:type', 'rdfs:Class') && !this.hasValue('rdf:type', 'owl:Class');
  return Promise.resolve()
    .then(() => toBeSaved && this.trigger('beforeSave'))
    .then(() => {
      if (visited.has(this)) return;
      visited.add(this);
      if (toBeSaved) acc.push(this.properties);
      let children = [];
      for (const property in this.properties) {
        if (property === '@') continue;
        const values = this.get(property);
        if (!(values[0] instanceof IndividualModel)) continue;
        children = children.concat(values.map((value) => value.saveAll(this, acc, visited)));
      }
      for (let i = 0; i < this.removedObjs.length; i++) {
        const value = this.removedObjs[i];
        if (!(value instanceof IndividualModel)) continue;
        children = children.concat(value.saveAll(this, acc, visited));
      }
      return Promise.all(children);
    })
    .then(() => !parent && Promise.all(acc).then((acc) => acc.length && Backend.put_individuals(veda.ticket, acc)))
    .then(() => !parent && acc.forEach((props) => {
      const individual = new IndividualModel(props['@']);
      individual.original = JSON.stringify(props);
      individual.isNew(false);
      individual.isSync(true);
      individual.isLoaded(true);
      individual.watch();
      individual.trigger('afterSave');
    }))
    .catch((error) => {
      console.error('Save individual failed', this.id);
      throw error;
    });
};

/**
 * Reset the current individual to its backend state.
 * @memberof IndividualModel.prototype
 * @function reset
 * @return {Promise<IndividualModel>} Promise that resolves to the current IndividualModel instance.
 * @throws {Error} If reset fails for any reason.
 */
proto.reset = function () {
  /**
   * Merge the original state from the backend with local changes.
   * @memberof IndividualModel.prototype.reset
   * @inner
   * @param {Object} server_state - The server state of the individual.
   * @return {Promise<void>} Promise that resolves once the merge is completed.
   */
  const mergeServerState = (server_state) => {
    this.original = JSON.stringify(server_state);
    const delta = Util.diff(this.properties, server_state);
    this.properties = server_state;
    this.isNew(false);
    this.isSync(true);
    this.isLoaded(true);
    return Promise.all(
      Object.keys(delta.added)
        .concat(Object.keys(delta.differ))
        .concat(Object.keys(delta.missing))
        .map((property_uri) => {
          const values = this.get(property_uri);
          return this.trigger('propertyModified', property_uri, values).then(() =>
            this.trigger(property_uri, values),
          );
        }),
    );
  };

  return this.trigger('beforeReset')
    .then(() => {
      if (!this.isNew()) {
        return Backend.get_individual(veda.ticket, this.id, false).then(mergeServerState);
      }
      return null;
    })
    .then(() => this.trigger('afterReset'))
    .then(() => {
      this.watch();
      return this;
    })
    .catch((error) => {
      console.error('Reset individual failed', this.id);
      throw error;
    });
};

/**
 * Reset the individual and its entire tree to the backend state.
 * @memberof IndividualModel.prototype
 * @function resetAll
 * @param {WeakSet} [visited] - A WeakSet to track visited individuals during the reset process.
 * @return {Promise<IndividualModel>} Promise that resolves to the current IndividualModel instance.
 * @throws {Error} If reset fails for any reason.
 */
proto.resetAll = function (visited) {
  visited = visited || new WeakSet();
  const toBeReset = this.isLoaded() && !this.isSync();
  return Promise.resolve()
    .then(() => {
      if (visited.has(this)) return;
      visited.add(this);
      let children = [];
      for (const property in this.properties) {
        if (property === '@') continue;
        const values = this.get(property);
        if (!(values[0] instanceof IndividualModel)) continue;
        children = children.concat(values.map((value) => value.resetAll(visited)));
      }
      return Promise.all(children);
    })
    .then(() => {
      if (toBeReset) {
        return this.reset();
      }
    })
    .catch((error) => {
      console.error('Reset individual failed', this.id);
      throw error;
    });
};

/**
 * Mark the current individual as deleted in the backend by setting v-s:deleted to true.
 * @memberof IndividualModel.prototype
 * @function delete
 * @return {Promise<IndividualModel>} Promise that resolves to the current IndividualModel instance.
 * @throws {Error} If deletion fails for any reason.
 */
proto.delete = function () {
  if (this.isDeleting() && typeof window !== 'undefined') {
    return this.isDeleting();
  }
  return this.isDeleting(
    this.trigger('beforeDelete')
      .then(() => {
        if (this.isNew()) {
          return;
        }
        this['v-s:deleted'] = [true];
        this.addValue('rdf:type', 'v-s:Deletable');
        return this.save();
      })
      .then(() => this.trigger('afterDelete'))
      .then(() => {
        this.isDeleting(false);
        return this;
      })
      .catch((error) => {
        console.error('Delete individual failed', this.id);
        this.isDeleting(false);
        throw error;
      }),
  );
};

/**
 * Remove the individual from the backend.
 * @memberof IndividualModel.prototype
 * @function remove
 * @return {Promise<IndividualModel>} Promise that resolves to the current IndividualModel instance.
 * @throws {Error} If removal fails for any reason.
 */
proto.remove = function () {
  if (this.isRemoving() && typeof window !== 'undefined') {
    return this.isRemoving();
  }
  return this.isRemoving(
    this.trigger('beforeRemove')
      .then(() => {
        IndividualModel.cache.delete(this.id);
        if (this.isNew()) {
          return;
        }
        return Backend.remove_individual(veda.ticket, this.id);
      })
      .then(() => this.trigger('afterRemove'))
      .then(() => {
        this.isRemoving(false);
        this.unwatch();
        return this;
      })
      .catch((error) => {
        console.error('Remove individual failed', this.id);
        this.isRemoving(false);
        throw error;
      }),
  );
};

/**
 * Recover the current individual in the backend by removing the v-s:deleted property.
 * @memberof IndividualModel.prototype
 * @function recover
 * @return {Promise<IndividualModel>} Promise that resolves to the current IndividualModel instance.
 * @throws {Error} If recovery fails for any reason.
 */
proto.recover = function () {
  if (this.isRecovering() && typeof window !== 'undefined') {
    return this.isRecovering();
  }
  return this.isRecovering(
    this.trigger('beforeRecover')
      .then(() => {
        this['v-s:deleted'] = [false];
        return this.save();
      })
      .then(() => this.trigger('afterRecover'))
      .then(() => {
        this.isRecovering(false);
        return this;
      })
      .catch((error) => {
        console.error('Recover individual failed', this.id);
        this.isRecovering(false);
        throw error;
      }),
  );
};

/**
 * Check if the individual has a specific property and optionally check if it contains a specific value.
 * If only the property URI is provided, it checks if the individual has the property regardless of its value.
 * If both the property URI and a value are provided, it checks if the individual has the property with the specific value.
 * @memberof IndividualModel.prototype
 * @function hasValue
 * @param {string} property_uri - The URI of the property.
 * @param {Any_allowed_type} [value] - The value to check.
 * @return {boolean} - Returns true if the requested property (and optionally value) exists in the individual, otherwise false.
 */
proto.hasValue = function (property_uri, value) {
  if (!property_uri && typeof value !== 'undefined' && value !== null) {
    let found = false;
    for (const prop in this.properties) {
      if (prop === '@') {
        continue;
      }
      found = found || this.hasValue(prop, value);
    }
    return found;
  }
  let result = !!(this.properties[property_uri] && this.properties[property_uri].length);
  if (typeof value !== 'undefined' && value !== null) {
    const serialized = serializer(value);
    result = result && this.properties[property_uri].some((item) => {
      return (item.type === serialized.type && item.data === serialized.data && (item.lang && serialized.lang ? item.lang === serialized.lang : true));
    });
  }
  return result;
};

/**
 * Add one or more values to a property of the individual.
 * @memberof IndividualModel.prototype
 * @function addValue
 * @param {string} property_uri - The URI of the property.
 * @param {Any_allowed_type|Array<Any_allowed_type>} values - The value(s) to add.
 * @param {boolean} [silently] - Indicates whether to trigger propertyModified and property events.
 * @return {Promise<IndividualModel>} - Promise that resolves to the current IndividualModel instance.
 */
proto.addValue = function (property_uri, values, silently) {
  if (typeof values === 'undefined' || values === null) {
    return Promise.resolve(this);
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
    return this.trigger('propertyModified', property_uri, values)
      .then(() => this.trigger(property_uri, values));
  }
  return Promise.resolve(this);
};

/**
 * Utility function to add a single value to a property of the individual.
 * @param {string} property_uri - The URI of the property.
 * @param {Any_allowed_type} value - The value to add.
 * @return {void}
 * @private
 * @this IndividualModel
 */
function addSingleValue (property_uri, value) {
  if (value != undefined) {
    const serialized = serializer(value);
    this.properties[property_uri].push(serialized);
  }
}

/**
 * Remove one or more values from a property of the individual.
 * @memberof IndividualModel.prototype
 * @function removeValue
 * @param {string} property_uri - The URI of the property.
 * @param {Any_allowed_type|Array<Any_allowed_type>} values - The value(s) to remove.
 * @param {boolean} [silently] - Indicates whether to trigger propertyModified and property events.
 * @return {Promise<IndividualModel>} - Promise that resolves to the current IndividualModel instance.
 */
proto.removeValue = function (property_uri, values, silently) {
  if (!property_uri) {
    return Object.keys(this.properties).filter((property) => property !== '@').reduce(
      (p, property) => p.then(() => this.removeValue(property, values, silently)),
      Promise.resolve(),
    );
  }
  if (!this.properties[property_uri] || !this.properties[property_uri].length || typeof values === 'undefined' || values === null) {
    return Promise.resolve(this);
  }
  if ( Array.isArray(values) ) {
    values.forEach((value) => removeSingleValue.call(this, property_uri, value));
  } else {
    removeSingleValue.call(this, property_uri, values);
  }
  this.isSync(false);
  if ( !silently ) {
    values = this.get(property_uri);
    return this.trigger('propertyModified', property_uri, values)
      .then(() => this.trigger(property_uri, values));
  }
  return Promise.resolve(this);
};

/**
 * Utility function to remove a single value from a property of the individual.
 * @param {string} property_uri - The URI of the property.
 * @param {Any_allowed_type} value - The value to remove.
 * @return {void}
 * @private
 * @this IndividualModel
 */
function removeSingleValue (property_uri, value) {
  if (value != undefined) {
    const serialized = serializer(value);
    this.properties[property_uri] = (this.properties[property_uri] || []).filter((item) => {
      return !( item.data == serialized.data && (item.lang && serialized.lang ? item.lang === serialized.lang : true) );
    });
  }
}

/**
 * Toggle the presence of one or more values in a property of the individual.
 * If the value already exists, it will be removed. If it doesn't exist, it will be added.
 * @memberof IndividualModel.prototype
 * @function toggleValue
 * @param {string} property_uri - The URI of the property.
 * @param {Any_allowed_type|Array<Any_allowed_type>} values - The value(s) to toggle.
 * @param {boolean} [silently] - Indicates whether to trigger propertyModified and property events.
 * @return {Promise<IndividualModel>} - Promise that resolves to the current IndividualModel instance.
 */
proto.toggleValue = function (property_uri, values, silently) {
  if (typeof values === 'undefined' || values === null) {
    return Promise.resolve(this);
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
    return this.trigger('propertyModified', property_uri, values)
      .then(() => this.trigger(property_uri, values));
  }
  return Promise.resolve(this);
};

/**
 * Utility function to toggle the presence of a single value in a property of the individual.
 * If the value already exists, it will be removed. If it doesn't exist, it will be added.
 * @param {string} property_uri - The URI of the property.
 * @param {Any_allowed_type} value - The value to toggle.
 * @return {void}
 * @private
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
 * Clear all values of a property in the individual.
 * @memberof IndividualModel.prototype
 * @function clearValue
 * @param {string} property_uri - The URI of the property.
 * @param {boolean} [silently] - Indicates whether to trigger propertyModified and property events.
 * @return {Promise<IndividualModel>} - Promise that resolves to the current IndividualModel instance.
 */
proto.clearValue = function (property_uri, silently) {
  if (!this.properties[property_uri] || !this.properties[property_uri].length) {
    return Promise.resolve(this);
  } else {
    delete this.properties[property_uri];
    this.isSync(false);
    if ( !silently ) {
      const empty = [];
      return this.trigger('propertyModified', property_uri, empty)
        .then(() => this.trigger(property_uri, empty));
    }
  }
  return Promise.resolve(this);
};

/**
 * Check if the individual is an instance of a specific class.
 * @memberof IndividualModel.prototype
 * @function is
 * @param {string|IndividualModel} _class - The ID or IndividualModel of the class to check.
 * @return {boolean} - Returns true if the individual's rdf:type is a subclass of the requested class, otherwise false.
 */
proto.is = function (_class) {
  const isSub = function (type) {
    if (is) {
      return is;
    }
    if (!type.hasValue('rdfs:subClassOf')) {
      is = is || false;
      return is;
    } else if (type.hasValue('rdfs:subClassOf', _class.id)) {
      is = is || true;
      return is;
    } else {
      const superClasses = type.get('rdfs:subClassOf');
      return Promise.all(superClasses.map(isSub)).then((results) =>
        results.reduce((state, isSubClass) => state || isSubClass, false),
      );
    }
  };

  if (typeof _class.valueOf() === 'string') {
    _class = new IndividualModel(_class.valueOf());
  }
  const types = this.get('rdf:type');
  let is = types.reduce((state, type) => state || this.hasValue('rdf:type', _class.id), false);
  if (is) {
    return Promise.resolve(is);
  } else {
    return Promise.all(types.map(isSub)).then((results) =>
      results.reduce((state, isSubClass) => state || isSubClass, false),
    );
  }
};

/**
 * Initialize the individual with class-specific domain properties and methods.
 * @memberof IndividualModel.prototype
 * @function init
 * @param {boolean} [forced] - Indicates whether to force the initialization even if the individual is already initialized.
 * @return {Promise<IndividualModel>} - Promise that resolves to the current IndividualModel instance.
 */
proto.init = function (forced) {
  if (!forced && (this.isInited() || !this._.init)) {
    return Promise.resolve(this);
  }
  const isClass = this.hasValue('rdf:type', 'owl:Class') || this.hasValue('rdf:type', 'rdfs:Class');
  if ( this.hasValue('v-ui:hasModel') && !isClass ) {
    return this.get('v-ui:hasModel')[0].load()
      .then((model) => {
        if (!model.hasValue('rdf:type', 'v-ui:ClassModel')) {
          throw new TypeError('v-ui:ClassModel required!');
        }
        if (!model.modelFn) {
          model.modelFn = new Function('veda', model.get('v-s:script')[0] + ' //# sourceURL=' + model.id);
        }
        model.modelFn.call(this, veda);
        this.isInited(true);
        return this;
      });
  } else {
    const typePromises = this.get('rdf:type').map((typePromise) => {
      return typePromise.load();
    });
    return Promise.all( typePromises )
      .then((types) => {
        const modelPromises = [];
        types.map((type) => {
          if ( type.hasValue('v-ui:hasModel') ) {
            modelPromises.push( type.get('v-ui:hasModel')[0].load() );
          }
        });
        return Promise.all( modelPromises );
      })
      .then((models) => {
        models.forEach((model) => {
          if ( !model.modelFn ) {
            model.modelFn = new Function('veda', model.get('v-s:script')[0] + ' //# sourceURL=' + model.id);
          }
          model.modelFn.call(this, veda);
        });
        this.isInited(true);
        return this;
      });
  }
};

/**
 * Clone the individual with a different (generated) ID.
 * @memberof IndividualModel.prototype
 * @function clone
 * @return {Promise<IndividualModel>} - Promise that resolves to the clone of this individual with a different ID.
 */
proto.clone = function () {
  const cloneProperties = JSON.parse(JSON.stringify(this.properties));
  cloneProperties['@'] = Util.genUri();
  const clone = new IndividualModel(cloneProperties);
  clone.isNew(true);
  clone.isSync(false);
  clone.clearValue('v-s:updateCounter');
  return clone.init();
};

/**
 * Set/get the flag indicating whether the individual is initialized.
 * @memberof IndividualModel.prototype
 * @function isInited
 * @param {boolean} [value] - The value to set.
 * @return {boolean} - The current value of the flag.
 */
proto.isInited = function (value) {
  if (typeof value !== 'undefined') {
    this._.isInited = value;
  }
  return this._.isInited;
};

/**
 * Set/get the flag indicating whether the individual is synchronized with the database.
 * @memberof IndividualModel.prototype
 * @function isSync
 * @param {boolean} [value] - The value to set.
 * @return {boolean} - The current value of the flag.
 */
proto.isSync = function (value) {
  if (typeof value !== 'undefined') {
    this._.isSync = value;
  }
  return this._.isSync;
};

/**
 * Set/get the flag indicating whether the individual is new (not saved in the database).
 * @memberof IndividualModel.prototype
 * @function isNew
 * @param {boolean} [value] - The value to set.
 * @return {boolean} - The current value of the flag.
 */
proto.isNew = function (value) {
  if (typeof value !== 'undefined') {
    this._.isNew = value;
  }
  return this._.isNew;
};

/**
 * Set/get the flag indicating whether the individual data were loaded from the database.
 * @memberof IndividualModel.prototype
 * @function isLoaded
 * @param {boolean} [value] - The value to set.
 * @return {boolean} - The current value of the flag.
 */
proto.isLoaded = function (value) {
  if (typeof value !== 'undefined') {
    this._.isLoaded = value;
  }
  return this._.isLoaded;
};

/**
 * Get/set the flag indicating whether an operation is pending for the individual.
 * @param {string} operation - The name of the operation (e.g., 'loading', 'saving').
 * @param {boolean} [value] - The value to set.
 * @return {boolean} - The current value of the flag.
 */
proto.isPending = function (operation, value) {
  if (typeof value !== 'undefined') {
    this._[operation] = value;
  }
  return this._[operation];
};

/**
 * Get/set the flag indicating whether the individual is currently loading.
 * @memberof IndividualModel.prototype
 * @function isLoading
 * @param {boolean} [value] - The value to set.
 * @return {boolean} - The current value of the flag.
 */
proto.isLoading = function (value) {
  return this.isPending('loading', value);
};

/**
 * Get/set the flag indicating whether the individual is currently saving.
 * @memberof IndividualModel.prototype
 * @function isSaving
 * @param {boolean} [value] - The value to set.
 * @return {boolean} - The current value of the flag.
 */
proto.isSaving = function (value) {
  return this.isPending('saving', value);
};

/**
 * Get/set the flag indicating whether the individual is currently being deleted.
 * @memberof IndividualModel.prototype
 * @function isDeleting
 * @param {boolean} [value] - The value to set.
 * @return {boolean} - The current value of the flag.
 */
proto.isDeleting = function (value) {
  return this.isPending('deleting', value);
};

/**
 * Get/set the flag indicating whether the individual is currently being removed from the backend.
 * @memberof IndividualModel.prototype
 * @function isRemoving
 * @param {boolean} [value] - The value to set.
 * @return {boolean} - The current value of the flag.
 */
proto.isRemoving = function (value) {
  return this.isPending('removing', value);
};

/**
 * Get/set the flag indicating whether the individual is currently being recovered.
 * @memberof IndividualModel.prototype
 * @function isRecovering
 * @param {boolean} [value] - The value to set.
 * @return {boolean} - The current value of the flag.
 */
proto.isRecovering = function (value) {
  return this.isPending('recovering', value);
};

/**
 * Serialize the individual to JSON.
 * @memberof IndividualModel.prototype
 * @function toJson
 * @return {Object} - JSON representation of the individual.
 */
proto.toJson = function () {
  return this.properties;
};

/**
 * Serialize the individual to a string.
 * @memberof IndividualModel.prototype
 * @function toString
 * @return {string} - String representation of the individual.
 */
proto.toString = function () {
  if (this.hasValue('rdfs:label')) {
    return this.get('rdfs:label').map(Util.formatValue).join(' ');
  } else if (this.hasValue('rdf:type')) {
    return this.get('rdf:type')[0].toString() + ': ' + this.id;
  } else {
    return this.id;
  }
};

/**
 * Return the ID of the individual.
 * @memberof IndividualModel.prototype
 * @function valueOf
 * @return {string} - The ID of the individual.
 */
proto.valueOf = function () {
  return this.id;
};

/**
 * Get values for the first branch of the property chain.
 * @memberof IndividualModel.prototype
 * @function getPropertyChain
 * @param {...string} ...args - The chain of properties to traverse.
 * @return {Promise<Array>} - Promise that resolves to an array of values from the property chain.
 */
proto.getPropertyChain = function (...args) {
  const property_uri = args.shift();
  return this.load().then(() => {
    if (this.hasValue(property_uri)) {
      if (!args.length) {
        return this[property_uri];
      } else {
        return this.getPropertyChain.apply(this[property_uri][0], args);
      }
    }
    return [];
  }).catch((error) => {
    console.error('Get property chain failed', error);
    return [];
  });
};

/**
 * Get values for all branches of the property chain.
 * @memberof IndividualModel.prototype
 * @function getChainValue
 * @param {...string} ...properties - The chain of properties to traverse.
 * @return {Promise<Array>} - Promise that resolves to an array of values from all branches of the property chain.
 */
proto.getChainValue = function (...properties) {
  let individuals = this;
  if (!Array.isArray(individuals)) {
    individuals = [individuals];
  }
  const property_uri = properties.shift();
  const promises = individuals.map((individual) => individual.load());
  return Promise.all(promises).then((loadedIndividuals) => {
    const children = loadedIndividuals.reduce((acc, individual) => acc.concat(individual[property_uri]), []);
    if (!properties.length) {
      return children;
    } else {
      return proto.getChainValue.apply(children, properties);
    }
  }).catch((error) => {
    console.error('Get chain value failed', error);
    return [];
  });
};

/**
 * Check if the property chain branches have a specific value.
 * @memberof IndividualModel.prototype
 * @function hasChainValue
 * @param {string} sought_value - The value to check for.
 * @param {...string} ...args - The chain of properties to traverse.
 * @return {Promise<boolean>} - Promise that resolves to true if the value is found in any branch of the property chain, otherwise false.
 */
proto.hasChainValue = function (sought_value, ...args) {
  return this.getChainValue(...args)
    .then((values) =>
      values.reduce((state, value) =>
        state || sought_value.valueOf() == value.valueOf(),
      false),
    );
};

/**
 * Prefetch linked objects. Useful for presenting objects with many links.
 * @memberof IndividualModel.prototype
 * @function prefetch
 * @param {number} depth - The depth of the object tree to prefetch.
 * @param {...string} allowed_props - The allowed properties to include in the prefetching.
 * @return {Promise<Array<IndividualModel>>} - Promise that resolves to an array of prefetched IndividualModel instances.
 */
proto.prefetch = function (depth, ...allowed_props) {
  depth = depth || 1;
  const self = this;

  return self.load().then(function () {
    const result = [];
    const uris = [self.id];

    function prefetchRecursive (depth, uris, result, allowed_props) {
      if (depth <= 0 || uris.length === 0) {
        return Promise.resolve(result);
      }

      const getUris = uris.filter(function (uri) {
        const cached = IndividualModel.cache.get(uri);
        const loaded = cached && cached.isLoaded();

        if (cached && loaded && result.indexOf(cached) < 0) {
          result.push(cached);
        }

        return !cached || !loaded;
      });

      const jsonListPromise = getUris.length ? Backend.get_individuals(veda.ticket, getUris) : Promise.resolve([]);
      return jsonListPromise.then(function (jsonList) {
        const jsonPromises = jsonList.map(function (json) {
          const individual = new IndividualModel(json);
          if (result.indexOf(individual) < 0) {
            result.push(individual);
          }
          return individual.load();
        });

        return Promise.all(jsonPromises).then(function () {
          const nextUris = [];
          uris.forEach(function (uri) {
            const individual = new IndividualModel(uri);
            const props = individual.properties;
            Object.keys(props).forEach(function (prop) {
              if (prop === '@' || (allowed_props.length && allowed_props.indexOf(prop) < 0)) return;
              props[prop].forEach(function (value) {
                if (value.type === 'Uri') nextUris.push(value.data);
              });
            });
          });

          return prefetchRecursive(depth - 1, nextUris, result, allowed_props);
        });
      });
    }

    return prefetchRecursive(depth, uris, result, allowed_props);
  });
};
