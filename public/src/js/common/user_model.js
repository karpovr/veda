// User Model

import veda from "../common/veda.js";

import Util from "../common/util.js";

import IndividualModel from "../common/individual_model.js";

export default veda.UserModel = UserModel;

function UserModel(uri) {

  var self = IndividualModel.call(this, uri);

  return self;

};

UserModel.prototype = Object.create(IndividualModel.prototype);

UserModel.prototype.constructor = UserModel;

var proto = UserModel.prototype;

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
    return new IndividualModel(aspect_id).load().then(function(loadedAspect) {
      if (loadedAspect.hasValue("rdf:type", "rdfs:Resource")) {
        self.aspect = new IndividualModel(aspect_id);
        self.aspect["rdf:type"] = [ new IndividualModel("v-s:PersonalAspect") ];
        self.aspect["v-s:owner"] = [ self ];
        self.aspect["rdfs:label"] = [ "PersonalAspect_" + self.id ];
        self["v-s:hasAspect"] = [ self.aspect ];
        return self.aspect.save();
      } else {
        self.aspect = loadedAspect;
        self["v-s:hasAspect"] = [ self.aspect ];
        return self.aspect;
      }
    });
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
    self.preferences = new IndividualModel(preferences_id);
    self.preferences["v-s:owner"] = [ self ];
    self.preferences["rdf:type"] = [ new IndividualModel("v-ui:Preferences") ];
    self.preferences["rdfs:label"] = [ "Preferences_" + self.id ];
    self["v-ui:hasPreferences"] = [ self.preferences ];
    return self.preferences;
  }
};

proto.initLanguage = function (preferences) {
  var self = this;
  if ( !preferences.hasValue("v-ui:preferredLanguage") || !preferences.hasValue("v-ui:displayedElements")) {
    var defaultDisplayedElements = 10;
    var defaultLanguage = new IndividualModel("v-ui:RU");
    preferences["v-ui:preferredLanguage"] = [ defaultLanguage ];
    preferences["v-ui:displayedElements"] = [ defaultDisplayedElements ];
    preferences.save();
  }
  preferences.on("v-ui:preferredLanguage", setLanguage);
  preferences.on("v-ui:displayedElements", setDisplayedElements);
  preferences.on("v-ui:preferredLanguage v-ui:displayedElements", updatePreferences);
  setLanguage();
  setDisplayedElements();
  function setLanguage() {
    preferences.language = preferences["v-ui:preferredLanguage"].reduce( function (acc, lang) {
      acc[lang.id.substr(lang.id.indexOf(":") + 1)] = lang;
      return acc;
    }, {});
    veda.trigger("language:changed");
  }
  function setDisplayedElements() {
    preferences.displayedElements = preferences["v-ui:displayedElements"][0] || 10;
  }
  function updatePreferences() {
    if ( self.id !== "cfg:Guest" ) {
      preferences.save();
    }
  }
};
