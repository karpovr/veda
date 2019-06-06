// User Model

veda.Module(function (veda) { "use strict";

  veda.UserModel = function (uri) {

    var self = veda.IndividualModel.call(this, uri);

    return self;

  };

  veda.UserModel.prototype = Object.create(veda.IndividualModel.prototype);

  veda.UserModel.prototype.constructor = veda.UserModel;

  var proto = veda.UserModel.prototype;

  proto._init = function () {
    var self = this;
    return this.load()
      .then(self.initAspect.bind(self))
      .then(self.initAppointment.bind(self))
      .then(self.initPreferences.bind(self))
      .then(self.initLanguage.bind(self))
      .then(self.save.bind(self));
  };

  proto.initAspect = function () {
    var self = this;
    if ( self.hasValue("v-s:hasAspect") ) {
      self.aspect = self["v-s:hasAspect"][0];
      return self.aspect.load();
    } else {
      var aspect_id = self.id + "_aspect";
      self.aspect = new veda.IndividualModel(aspect_id);
      self.aspect["rdf:type"] = [ new veda.IndividualModel("v-s:PersonalAspect") ];
      self.aspect["v-s:owner"] = [ self ];
      self.aspect["rdfs:label"] = [ "PersonalAspect_" + self.id ];
      self["v-s:hasAspect"] = [ self.aspect ];
      return self.aspect.save();
    }
  };

  proto.initAppointment = function () {
    var self = this;
    if (self.hasValue("v-s:defaultAppointment")) {
      veda.appointment = self["v-s:defaultAppointment"][0];
    } else if (self.hasValue("v-s:hasAppointment")) {
      self["v-s:defaultAppointment"] = [ self["v-s:hasAppointment"][0] ];
      veda.appointment = self["v-s:defaultAppointment"][0];
    } else {
      return veda.appointment = undefined;
    }
    return veda.appointment.load();
  };

  proto.initPreferences = function () {
    var self = this;
    if ( self.hasValue("v-ui:hasPreferences") ) {
      self.preferences = self["v-ui:hasPreferences"][0];
      return self.preferences.load();
    } else {
      var preferences_id = self.id + "_pref";
      self.preferences = new veda.IndividualModel(preferences_id);
      self.preferences["v-s:owner"] = [ self ];
      self.preferences["rdf:type"] = [ new veda.IndividualModel("v-ui:Preferences") ];
      self.preferences["rdfs:label"] = [ "Preferences_" + self.id ];
      return self.preferences;
    }
  };

  proto.initLanguage = function (preferences) {
    var self = this;
    if ( !preferences.hasValue("v-ui:preferredLanguage") || !preferences.hasValue("v-ui:displayedElements")) {
      var defaultDisplayedElements = new veda.IndividualModel("v-ui:DefaultDisplayedElements");
      var defaultLanguage = new veda.IndividualModel("v-ui:DefaultLanguage");
      Promise.all([defaultLanguage.load(), defaultDisplayedElements.load()]).then(function (defaults) {
        preferences["v-ui:preferredLanguage"] = [ defaults[0]["rdf:value"][0] ];
        preferences["v-ui:displayedElements"] = [ defaults[1]["rdf:value"][0] ];
        if (self.id !== "cfg:Guest") {
          preferences.save();
        }
      });
    }
    preferences.on("v-ui:preferredLanguage", setLanguage);
    setLanguage();
    function setLanguage() {
      preferences.language = preferences["v-ui:preferredLanguage"].reduce( function (acc, lang) {
        acc[lang.id.substr(lang.id.indexOf(":") + 1)] = lang;
        return acc;
      }, {});
      if ( !preferences.isSync() && self.id !== "cfg:Guest" ) {
        preferences.save();
      }
      veda.trigger("language:changed");
    }
    preferences.on("v-ui:displayedElements", setDisplayedElements);
    setDisplayedElements();
    function setDisplayedElements() {
      preferences.displayedElements = preferences["v-ui:displayedElements"][0] || 10;
      if ( !preferences.isSync() && self.id !== "cfg:Guest" ) {
        preferences.save();
      }
    }
  };

});
