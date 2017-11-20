/**
 * @class veda.IndividualModelAsync
 *
 * This class is used to manipulate individuals (async).
 */
veda.Module(function (veda) { "use strict";

  /**
   * @constructor
   * @param {String} uri URI of individual. If not specified, than id of individual will be generated automatically.
   * @param {boolean} cache Use cache true / false. If true or not set, then object will be return from application cache (veda.cache). If false or individual not found in application cache - than individual will be loaded from database
   * @param {boolean} init individual with class model at load. If true or not set, then individual will be initialized with class specific model upon load.
   */
  veda.IndividualModelAsync = function (uri, cache, init) {

    var self = riot.observable(this);

    // veda.IndividualModelAsync({...})
    if (typeof uri === "object" && !uri["@"]) {
      cache = uri.cache;
      init  = uri.init;
      uri   = uri.uri;
    }

    // Define Model functions
    this._ = {
      cache: typeof cache !== "undefined" ? cache : true,
      init: typeof init !== "undefined" ? init : true,
      isNew: false,
      isSync: false,
      uri: uri
    };
    this.properties = {};
    this.filtered = {};

    this.on("rdf:type", this.init);
    this.on("beforeSave", beforeSaveHandler);

    return this;
  };

  function beforeSaveHandler() {
    var now = new Date();
    var user = veda.appointment ? veda.appointment : veda.user;
    if (
      !this.hasValue("v-s:lastEditor")
      || !this.hasValue("v-s:edited")
      || this["v-s:lastEditor"][0].id !== user.id
      || (now - this["v-s:edited"][0]) > 1000
    ) {
      this["v-s:edited"] = [ now ];
      this["v-s:lastEditor"] = [ user ];
    }
    if ( !this.hasValue("v-s:creator") && !this.hasValue("v-s:created") ) {
      this["v-s:creator"] = [ user ];
      this["v-s:created"] = [ now ];
    }
  }

  var proto = veda.IndividualModelAsync.prototype;

  proto.get = function (property_uri) {
    var self = this;
    if (!self.properties[property_uri]) return [];
    self.filtered[property_uri] = [];
    return self.properties[property_uri]
      .filter(function (value) {
        var condition = !value.lang || value.lang === "NONE" || ( veda.user && veda.user.language && value.lang in veda.user.language ) ;
        return condition ? condition : ( self.filtered[property_uri].push(value), condition );
      })
      .map( parser );
  };

  proto.set = function (property_uri, values) {
    this.isSync(false);
    values = values.filter(function (i) { return i != undefined; });
    var serialized = values.map( serializer );
    var uniq = unique(serialized);
    if (this.filtered[property_uri] && this.filtered[property_uri].length) {
      uniq = serialized.concat( this.filtered[property_uri] );
    }
    if ( JSON.stringify(this.properties[property_uri]) !== JSON.stringify(uniq) ) {
      this.properties[property_uri] = uniq;
      this.trigger("propertyModified", property_uri, values);
      this.trigger(property_uri, values);
    }
  };

  function unique (arr) {
    var n = {}, r = [];
    for(var i = 0, val; i < arr.length; i++) {
      val = arr[i].type + arr[i].data + (arr[i].lang || "");
      if (!n[val]) {
        n[val] = true;
        r.push(arr[i]);
      }
    }
    return r;
  }

  // Define properties from ontology in veda.IndividualModelAsync.prototype
  veda.IndividualModelAsync.defineProperty = function (property_uri) {
    Object.defineProperty(proto, property_uri, {
      get: function () {
        return this.get(property_uri);
      },
      set: function (values) {
        return this.set(property_uri, values);
      },
      configurable: false,
      enumerable: false
    });
  }

  function parser (value) {
    if (value.type === "String" || value.type === 2) {
      var string = new String(value.data);
      if (value.lang !== "NONE") { string.language = value.lang };
      return string;
    } else if (value.type === "Uri" || value.type === 1) {
      if (value.data.search(/^.{3,5}:\/\//) === 0) return value.data;
      return new veda.IndividualModelAsync({uri: value.data});
    } else if (value.type === "Datetime" || value.type === 8) {
      return new Date(Date.parse(value.data));
    } else if (value.type === "Decimal" || value.type === 32) {
      return parseFloat(value.data);
    } else {
      return value.data;
    }
  }

  function serializer (value) {
    if (typeof value === "number" ) {
      return {
        type: isInteger(value) ? "Integer" : "Decimal",
        data: value
      }
    } else if (typeof value === "boolean") {
      return {
        type: "Boolean",
        data: value
      }
    } else if (typeof value === "string" || value instanceof String) {
      return {
        type: "String",
        data: value.valueOf(),
        lang: value.language || "NONE"
      }
    } else if (value instanceof Date) {
      return {
        type: "Datetime",
        data: value.toISOString()
      }
    } else if (value instanceof veda.IndividualModelAsync) {
      return {
        type: "Uri",
        data: value.id
      }
    } else {
      return value;
    }
  }

  function isInteger (n) { return n % 1 === 0; }

  // Special properties
  Object.defineProperty(proto, "id", {
    get: function () {
      return this.properties["@"];
    },
    set: function (value) {
      var previous = this.properties && this.properties["@"];
      if (previous && this._.cache && veda.cache[previous]) {
        delete veda.cache[previous];
        veda.cache[value] = this;
      }
      this.properties["@"] = value;
      this.trigger("idChanged", value);
    }
  });

  Object.defineProperty(proto, "membership", {
    get: function () {
      if (this._.membership) return this._.membership;
      if (this.isNew() || this.hasValue("v-s:isDraft", true)) {
        this._.membership = new veda.IndividualModelAsync({ cache: false });
        return this._.membership;
      }
      try {
        var membershipJSON = get_membership(veda.ticket, this.id);
        this._.membership = new veda.IndividualModelAsync({ uri: membershipJSON, cache: false });
      } catch (e) {
        this._.membership = new veda.IndividualModelAsync();
      } finally {
        return this._.membership;
      }
    },
    configurable: false,
    enumerable: false
  });

  Object.defineProperty(proto, "rights", {
    get: function () {
      var self = this;
      if (this._.rights) return this._.rights;
      if (this.isNew() || this.hasValue("v-s:isDraft", true)) {
        this._.rights = new veda.IndividualModelAsync({ cache: false });
        this._.rights["v-s:canRead"] = [ true ];
        this._.rights["v-s:canUpdate"] = [ true ];
        this._.rights["v-s:canDelete"] = [ true ];
        return this._.rights;
      }
      get_rights({
        ticket: veda.ticket,  
        uri: this.id,
        async: true
      }).then(function (rightsJSON) {
        return new veda.IndividualModelAsync({ uri: rightsJSON, cache: false }).load();
      }).catch(function () {
        self._.rights = new veda.IndividualModelAsync();
        return self._.rights;
      });
    },
    configurable: false,
    enumerable: false
  });

  Object.defineProperty(proto, "rightsOrigin", {
    get: function () {
      if (this._.rightsOrigin) return this._.rightsOrigin;
      try {
        var rightsOriginArr = get_rights_origin(veda.ticket, this.id);
        this._.rightsOrigin = rightsOriginArr.map(function (origin) {
          return new veda.IndividualModelAsync({ uri: origin, cache: false });
        });
      } catch (e) {
        this._.rightsOrigin = [];
      } finally {
        return this._.rightsOrigin;
      }
    },
    configurable: false,
    enumerable: false
  });

  /**
   * @method
   * Load individual specified by uri from database. If cache parameter (from constructor) is true, than try to load individual from browser cache first.
   * @param {String} uri individual uri
   */
  proto.load = function () {
    var uri = this._.uri;
    var self = this;
    this.trigger("beforeLoad");
    if (typeof uri === "string") {
      this.id = uri;

      if (this._.cache && veda.cache[uri]) {
        if ( veda.cache[uri] instanceof veda.IndividualModelAsync ) {
          this.trigger("afterLoad", veda.cache[uri]);
          return Promise.resolve(veda.cache[uri]);
        } else if ( veda.cache[uri] instanceof veda.IndividualModel ) {
          var asyncModel = new veda.IndividualModelAsync( veda.cache[uri].properties );
          return asyncModel.load();
        }
      }

      return get_individual({ticket: veda.ticket, uri: uri, async: true})
        .then(function (properties) {
          self.properties = properties;
          self.isNew(false);
          self.isSync(true);
          if (self._.cache) veda.cache[self.id] = self;
          if (self._.init) self.init();
          self.trigger("afterLoad", self);
          return self;
        })
        .catch(function (error) {
          var notify = veda.Notify ? new veda.Notify() : function () {};
          notify("danger", error);
          if (error.code === 422) {
            self.isNew(true);
            self.isSync(false);
            self.properties = {
              "@": uri,
              "rdf:type": [{type: "Uri", data: "rdfs:Resource"}],
              "rdfs:label": [
                {type: "String", data: "Объект не существует", lang: "RU"},
                {type: "String", data: "Object does not exist", lang: "EN"}
              ]
            };
          } else if (error.code === 472) {
            self.isNew(false);
            self.isSync(false);
            self.properties = {
              "@": uri,
              "rdf:type": [{type: "Uri", data: "rdfs:Resource"}],
              "rdfs:label": [
                {type: "String", data: "Нет прав на объект", lang: "RU"},
                {type: "String", data: "Insufficient rights", lang: "EN"}
              ]
            };
          } else {
            self.isNew(false);
            self.isSync(false);
            self.properties = {
              "@": uri,
              "rdf:type": [{type: "Uri", data: "rdfs:Resource"}],
              "rdfs:label": [{type: "String", data: uri, lang: "NONE"}]
            };
          }
          return self;
        });
    } else if (typeof uri === "object") {
      this.isNew(false);
      this.isSync(true);
      this.properties = uri;
    } else if (typeof uri === "undefined") {
      this.isNew(true);
      this.isSync(false);
      this.id = veda.Util.genUri();
    }
    if (this._.cache) veda.cache[this.id] = this;
    if (this._.init) this.init();
    this.trigger("afterLoad", this);
    return Promise.resolve(this);
  };

  /**
   * @method
   * Save current individual to database (with validation and adding new version)
   */
  proto.save = function () {
    var self = this;
    // Do not save individual to server if nothing changed
    if (self.isSync()) {
      return Promise.resolve(self);
    }
    self.trigger("beforeSave");
    if ( self.hasValue("v-s:isDraft", true) ) {
      veda.drafts.remove(self.id);
    }
    Object.keys(self.properties).reduce(function (acc, property_uri) {
      if (property_uri === "@") return acc;
      acc[property_uri] = self.properties[property_uri].filter(function (item) {
        return item && item.data !== "";
      });
      if (!acc[property_uri].length) delete acc[property_uri];
      return acc;
    }, self.properties);
    return put_individual({ticket: veda.ticket, individual: self.properties, async: true})
      .then(function () {
        self.isNew(false);
        self.isSync(true);
        if (self._.cache) veda.cache[self.id] = self;
        self.trigger("afterSave");
        return self;
      })
      .catch(function (error) {
        var notify = veda.Notify ? new veda.Notify() : function () {};
        notify("danger", error);
        if (error.code !== 472) {
          self.draft();
        }
        return Promise.resolve(self);
      });
  }

  /**
   * @method
   * Save current individual without validation and without adding new version
   */
  proto.draft = function() {
    this.trigger("beforeDraft");
    veda.drafts.set(this.id, this);
    this.trigger("afterDraft");
    return this;
  }

  /**
   * @method
   * Reset current individual to database
   */
  proto.reset = function () {
    this.trigger("beforeReset");
    var self = this;
    self.filtered = {};
    if ( self.hasValue("v-s:isDraft") ) {
      var drafts = new veda.DraftsModel();
      drafts.remove(self.id);
    }
    return get_individual({
      ticket: veda.ticket,
      uri: self.id,
      async: true
    }).then(function (original) {
      var self_property_uris = Object.keys(self.properties);
      var original_property_uris = Object.keys(original);
      var union = veda.Util.unique( self_property_uris.concat(original_property_uris) );
      self.properties = original;
      self.isNew(false);
      self.isSync(true);
      union.forEach( function (property_uri) {
        if (property_uri === "@") { return; }
        self.trigger("propertyModified", property_uri, self.get(property_uri));
        self.trigger(property_uri, self.get(property_uri));
      });
      self.trigger("afterReset");
    }).catch(function (error) {
      console.log("reset individual error", error);
      self.trigger("afterReset");
    });
  };

  /**
   * @method
   * Mark current individual as deleted in database (add v-s:deleted property)
   */
  proto.delete = function () {
    this.trigger("beforeDelete");
    if ( this.hasValue("v-s:isDraft", true) ) {
      veda.drafts.remove(this.id);
    }
    if ( !this.isNew() ) {
      this["v-s:deleted"] = [ true ];
      return this.save()
        .then( function (self) {
          self.trigger("afterDelete");
          return self;
        });
    }
    this.trigger("afterDelete");
    return Promise.resolve(this);
  };

  /**
   * @method
   * Remove individual from database
   */
  proto.remove = function () {
    var self = this;
    this.trigger("beforeRemove");
    if ( this.hasValue("v-s:isDraft", true) ) {
      veda.drafts.remove(this.id);
    }
    if ( !this.isNew() ) {
      return remove_individual({
        ticket: veda.ticket, 
        uri: this.id,
        async: true
      }).then(function () {
        self.trigger("afterRemove");
        return self;
      });
    }
    if ( this._.cache && veda.cache && veda.cache[this.id] ) {
      delete veda.cache[this.id];
    }
    this.trigger("afterRemove");
    return this;
  };

  /**
   * @method
   * Recover current individual in database (remove v-s:deleted property)
   */
  proto.recover = function () {
    this.trigger("beforeRecover");
    if ( this.hasValue("v-s:isDraft", true) ) {
      veda.drafts.remove(this.id);
    }
    this["v-s:deleted"] = [];
    return this.save()
      .then( function (self) {
        self.trigger("afterRecover");
        return self;
      });
    this.trigger("afterRecover");
    return Promise.resolve(this);
  };

  /**
   * @method
   * @param {String} property_uri property name
   * @return {boolean} is requested property exists in this individual
   */
  proto.hasValue = function (property_uri, value) {
    var result = !!(this.properties[property_uri] && this.properties[property_uri].length);
    if (typeof value !== "undefined" && value !== null) {
      var serialized = serializer(value);
      result = result && !!this.properties[property_uri].filter( function (item) {
        return ( item.data == serialized.data && (item.lang && serialized.lang ? item.lang === serialized.lang : true) );
      }).length;
    }
    return result;
  };

  /**
   * @method
   * @param {String} property_uri property name
   * @param {Any allowed type} value
   * @return {this}
   */
  proto.addValue = function (property_uri, value) {
    if (typeof value !== "undefined" && value !== null) {
      var serialized = serializer(value);
      this.properties[property_uri] = (this.properties[property_uri] || []).filter(function (item) {
        return !( item.data == serialized.data && (item.lang && serialized.lang ? item.lang === serialized.lang : true) );
      });
      this.properties[property_uri].push(serialized);
      var values = this.get(property_uri);
      this.isSync(false);
      this.trigger("propertyModified", property_uri, values);
      this.trigger(property_uri, values);
    }
    return this;
  };

  /**
   * @method
   * @param {String} property_uri property name
   * @param {Any allowed type} value
   * @return {this}
   */
  proto.removeValue = function (property_uri, value) {
    if (!this.properties[property_uri] || !this.properties[property_uri].length) {
      return this;
    }
    if (typeof value !== "undefined" && value !== null) {
      var serialized = serializer(value);
      this.properties[property_uri] = (this.properties[property_uri] || []).filter(function (item) {
        return !( item.data == serialized.data && (item.lang && serialized.lang ? item.lang === serialized.lang : true) );
      });
      var values = this.get(property_uri);
      this.isSync(false);
      this.trigger("propertyModified", property_uri, values);
      this.trigger(property_uri, values);
    }
    return this;
  };

  /**
   * @method
   * @param {String} property_uri property name
   * @return {this}
   */
  proto.clearValue = function (property_uri) {
    if (!this.properties[property_uri] || !this.properties[property_uri].length) {
      return this;
    } else {
      var empty = [];
      this.properties[property_uri] = empty;
      this.isSync(false);
      this.trigger("propertyModified", empty);
      this.trigger(property_uri, empty);
    }
    return this;
  };

  /**
   * @method
   * @param {String} id of class to check
   * @return {boolean} is individual rdf:type subclass of requested class
   */
  proto.is = function (_class) {
    if (typeof _class.valueOf() === "string") {
      _class = new veda.IndividualModelAsync( _class.valueOf() );
    }
    return this["rdf:type"].reduce(function (acc, item) {
      return acc || (item.id === _class.id) || isSubClassOf(item, _class);
    }, false);
  };
  function isSubClassOf(_class, _super) {
    if (!_class.hasValue("rdfs:subClassOf")) return false;
    return _class["rdfs:subClassOf"].reduce(function (acc, item) {
      return acc || (item.id === _super.id) || isSubClassOf(item, _super);
    }, false);
  }

  /**
   * @method
   * Initialize individual with class specific domain properties and methods
   */
  proto.init = function () {
    var self = this;
    if ( this.hasValue("v-ui:hasCustomModel") ) {
      return this["v-ui:hasCustomModel"][0].load()
        .then(function (model) {
          model = new Function(model["v-s:script"][0]);
          model.call(self);
          return self;
        });
    } else {
      var types_promises = this["rdf:type"].map( function (type_promise) {
        return type_promise.load();
      });
      return Promise.all( types_promises )
        .then( function (types) {
          var models_promises = [];
          types.map( function (type) {
            if ( type.hasValue("v-ui:hasModel") ) {
              models_promises.push( type["v-ui:hasModel"][0] );
            }
          });
          return Promise.all( models_promises );
        })
        .then( function (models) {
          models.map(function (model) {
            var model_fn = new Function( model["v-s:script"][0] );
            model_fn.call(self);
          });
          return self;
        });
    }
  };

  /**
   * @method
   * Clone individual with different (generated) id
   * @return {veda.IndividualModelAsync} clone of this individual with different id.
   */
  proto.clone = function () {
    var individual = JSON.parse( JSON.stringify(this.properties) );
    individual["@"] = veda.Util.genUri();
    var clone = new veda.IndividualModelAsync(individual);
    clone.isNew(true);
    return clone;
  };

  /**
   * @method
   * Check whether individual is synchronized with db
   * @return {boolean}
   */
  proto.isSync = function (value) {
    return ( typeof value !== "undefined" ? this._.isSync = value : this._.isSync );
  };

  /**
   * @method
   * Check whether individual is new (not saved in db)
   * @return {boolean}
   */
  proto.isNew = function (value) {
    return ( typeof value !== "undefined" ? this._.isNew = value : this._.isNew );
  };

  /**
   * @method
   * Call individual presenter
   * @param {String/jQuery} container Container to render individual in. If passed as String, then must be a valid css selector. If passed as jQuery, then is used as is. If not specified, than individual will not be presented.
   * @param {String/jQuery/veda.IndividualModelAsync} template Template to render individual with.
   * @param {String} mode Initial mode for individual presenter. Expected values: "view", "edit", "search".
   */
  proto.present = function () {
    return veda.IndividualPresenterAsync.apply(this, arguments);
  };

  /**
   * @method
   * Serialize to JSON
   * @return {Object} JSON representation of individual.
   */
  proto.toJson = function () {
    return this.properties;
  };

  /**
   * @method
   * Serialize to string
   * @return {String} String representation of individual.
   */
  proto.toString = function () {
    return this.hasValue("rdfs:label") ? this["rdfs:label"].join(" ") : this.hasValue("rdf:type") ? this["rdf:type"][0].id + ": " + this.id : this.id ;
  };

  /**
   * @method
   * Return self
   * @return {Object} self.
   */
  proto.valueOf = function () {
    return this;
  };

  /**
   * @method
   * Prefetch linked objects. Useful for presenting objects with many links.
   * @param {Number} Depth of the object tree to prefetch.
   * @param {allowed_property_uri, ...} Allowed property uri for links. If defined the tree is formed only for allowed properties.
   */
  proto.prefetch = function (depth) {
    var allowed_props = [].slice.call(arguments, 1),
        uris = [],
        data = this.properties,
        prefetch = this.prefetch;
    Object.keys(data).map( function (key) {
      if ( key === "@" || (allowed_props.length && allowed_props.indexOf(key) < 0) ) return;
      data[key].map(function (value) {
        if (value.type !== "Uri") return;
        if (!veda.cache[value.data]) {
          uris.push(value.data);
        } else if (depth !== 0) {
          uris.push( prefetch.apply( veda.cache[value.data], [0].concat(allowed_props) ) );
        }
      });
    });
    uris = veda.Util.unique( veda.Util.flatten(uris, false) );
    for (var i = 0; i < depth && uris.length; i++) {
      var result = get_individuals(veda.ticket, uris),
        res_map = result.map(function (value) {
          var obj;
          if (!veda.cache[ value["@"] ]) {
            obj = new veda.IndividualModelAsync(value);
          } else {
            obj = veda.cache[ value["@"] ];
          }
          return prefetch.apply( obj, [0].concat(allowed_props) );
        });
      uris = veda.Util.unique( veda.Util.flatten(res_map, false) );
    }
    return uris;
  };

});
