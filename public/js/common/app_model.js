// Veda application Model

;(function (veda) { "use strict";

  veda.AppModel = function (config) {

    var self = riot.observable(this);

    self.config = config;
    self.ticket = self.ticket || "";
    self.ontology = {};
    self.cache = {
      limit: 20000,
      count: 0,
      delta: 1000,
      storage: {},
      expire: {},
      get: function (key) {
        return this.storage[key];
      },
      set: function (obj, expires) {
        var that = this;
        var count = this.count;
        var limit = this.limit;
        var delta = this.delta;
        if ( count >= limit ) {
          var keys = Object.keys(this.expire);
          // First key is for ontology objects
          for (var i = 1, key; (key = keys[i]) && (limit - count < delta); i++) {
            this.expire[ key ] = this.expire[ key ].filter(function (obj) {
              if (limit - count >= delta) { return true; }
              delete that.storage[ obj.id ];
              count--;
              return false;
            });
            if (this.expire[key].length === 0) {
              delete this.expire[key];
            }
          }
          this.count = count;
          console.log("veda.cache limit (" + this.limit + " elements) reached, " + this.delta + " removed.");
        }
        var expire_key = typeof expires === "number" ? expires : Date.now();
        obj.expires = expire_key;
        this.storage[ obj.id ] = obj;
        this.expire[ expire_key ] = this.expire[ expire_key ] || [];
        this.expire[ expire_key ].push(obj);
        this.count++;
      },
      remove: function (key) {
        var that = this;
        var obj = this.storage[key];
        var expires = obj.expires;
        this.expire[expires] = this.expire[expires].filter(function (item) { return item.id !== key });
        if (this.expire[expires].length === 0) {
          delete this.expire[expires];
        }
        this.count--;
        return delete this.storage[key];
      },
      clear: function () {
        this.count = 0;
        this.storage = {};
        this.expire = {};
      }
    };

    // Define Model functions
    self.login = function (username, password, secret) {
      return veda.Backend.authenticate(username, password, secret).then(function (auth) {
        veda.ticket = auth.id;
        veda.user_uri = auth.user_uri;
        veda.end_time = Math.floor((auth.end_time - 621355968000000000) / 10000 );
        return {
          ticket: veda.ticket,
          user_uri: veda.user_uri,
          end_time: veda.end_time
        };
      });
    };

    self.logout = function() {
      self.user_uri = self.ticket = self.end_time = "";
      self.cache.clear();
      self.status = "logout";
      self.trigger("logout");
    };

    // Load ontology
    self.init = function () {
      self.ontology = new veda.OntologyModel();
      return self.ontology.init().then(function () {
        self.user = new veda.UserModel("cfg:Guest");
        self.user._init();
      }).catch(function (err) {
        delete self.ontology;
      });
    };

    // Start application
    self.start = function () {
      self.trigger("starting");
      if ( !self.ontology ) {
        self.ontology = new veda.OntologyModel();
      }
      return self.ontology.init().then(function () {
        self.user = new veda.UserModel(self.user_uri);
        return self.user._init();
      }).then(function () {
        self.trigger("started");
      });
    };

    return self;
  };

})(veda);
