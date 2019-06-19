/**
  Local database for individuals
*/

veda.Module(function (veda) { "use strict";

  var db_name = "veda";
  var store_name = "individuals";

  veda.LocalDB = function () {

    var self = this;

    // Singleton pattern
    if (veda.LocalDB.prototype._singletonInstance) {
      return Promise.resolve(veda.LocalDB.prototype._singletonInstance);
    }

    return veda.LocalDB.prototype._singletonInstance = initDB();

    function initDB() {

      var fallback = {
        get: function (uri) {
          if (typeof this[uri] !== undefined) {
            return Promise.resolve(this[uri]);
          } else {
            return Promise.reject();
          }
        },
        put: function (json) {
          var id = json["@"];
          this[id] = json;
          return Promise.resolve(json);
        },
        remove: function (uri) {
          var result = delete this[uri];
          return Promise.resolve(result);
        }
      };

      return new Promise(function (resolve, reject) {
        var openReq = window.indexedDB.open(db_name, 1);

        openReq.onsuccess = function (event) {
          var db = event.target.result;
          self.db = db;
          console.log("DB open success");
          resolve(self);
        };

        openReq.onerror = function errorHandler(error) {
          console.log("DB open error", error);
          reject(error);
        };

        openReq.onupgradeneeded = function (event) {
          var db = event.target.result;
          db.createObjectStore(store_name);
          console.log("DB create success");
        };
      }).catch(function (error) {
        console.log("IndexedDB error, using in-memory fallback.\n", error);
        return fallback;
      });
    }
  };

  var proto = veda.LocalDB.prototype;

  proto.get = function (uri) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var request = self.db.transaction(["individuals"], "readonly").objectStore("individuals").get(uri);
      request.onerror = function(error) {
        reject(error);
      };
      request.onsuccess = function(event) {
        var json = request.result;
        if (typeof json !== "undefined") {
          resolve(json);
        } else {
          reject();
        }
      };
    });
  };

  proto.put = function (json) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var request = self.db.transaction(["individuals"], "readwrite").objectStore("individuals").put(json, json["@"]);
      request.onerror = function(error) {
        reject(error);
      };
      request.onsuccess = function(event) {
        resolve(json);
      };
    });
  };

  proto.remove = function (uri) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var request = self.db.transaction(["individuals"], "readwrite").objectStore("individuals").delete(uri);
      request.onerror = function(error) {
        reject(error);
      };
      request.onsuccess = function(event) {
        resolve(request.result);
      };
    });
  };

});
