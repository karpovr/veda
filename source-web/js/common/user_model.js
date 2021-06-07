// User Model

import veda from '../common/veda.js';

import IndividualModel from '../common/individual_model.js';

export default veda.UserModel = UserModel;

/**
 * Application user
 * @param {string} uri
 * @return {UserModel}
 */
function UserModel (uri) {
  return IndividualModel.call(this, uri);
};

UserModel.prototype = Object.create(IndividualModel.prototype);

UserModel.prototype.constructor = UserModel;

const proto = UserModel.prototype;

proto.getLanguage = function () {
  return this.preferences && this.preferences.language ? Object.keys(this.preferences.language) : undefined;
};

proto._init = function () {
  return this.load()
    .then(this.initAspect.bind(this))
    .then(this.initAppointment.bind(this))
    .then(this.initPreferences.bind(this))
    .then(this.initLanguage.bind(this))
    .then(() => {
      if ( this.id !== 'cfg:Guest' ) {
        return this.save();
      }
    })
    .catch((error) => {
      console.log('User init error', error.stack);
    });
};

proto.initAspect = function () {
  if ( this.hasValue('v-s:hasAspect') ) {
    this.aspect = this['v-s:hasAspect'][0];
    return this.aspect.load();
  } else {
    const aspect_id = this.id + '_aspect';
    return new IndividualModel(aspect_id).load().then((loadedAspect) => {
      if (loadedAspect.hasValue('rdf:type', 'rdfs:Resource')) {
        this.aspect = new IndividualModel(aspect_id);
        this.aspect['rdf:type'] = [new IndividualModel('v-s:PersonalAspect')];
        this.aspect['v-s:owner'] = [this];
        this.aspect['rdfs:label'] = ['PersonalAspect_' + this.id];
        this['v-s:hasAspect'] = [this.aspect];
        if ( this.id !== 'cfg:Guest' ) {
          return this.aspect.save();
        }
      } else {
        this.aspect = loadedAspect;
        this['v-s:hasAspect'] = [this.aspect];
        return this.aspect;
      }
    });
  }
};

proto.initAppointment = function () {
  if (this.hasValue('v-s:defaultAppointment')) {
    veda.appointment = this['v-s:defaultAppointment'][0];
  } else if (this.hasValue('v-s:hasAppointment')) {
    this['v-s:defaultAppointment'] = [this['v-s:hasAppointment'][0]];
    veda.appointment = this['v-s:defaultAppointment'][0];
  } else {
    return veda.appointment = undefined;
  }
  const setAppointment = () => {
    const appointment = this.hasValue('v-s:defaultAppointment') && this['v-s:defaultAppointment'][0];
    if (appointment) {
      appointment.load().then((appointment) => {
        veda.appointment = appointment;
      });
    }
    this.save();
  };
  this.on('v-s:defaultAppointment', setAppointment);
  return veda.appointment.load();
};

proto.initPreferences = function () {
  if ( this.hasValue('v-ui:hasPreferences') ) {
    this.preferences = this['v-ui:hasPreferences'][0];
    return this.preferences.load();
  } else {
    const preferences_id = this.id + '_pref';
    this.preferences = new IndividualModel(preferences_id);
    this.preferences['v-s:owner'] = [this];
    this.preferences['rdf:type'] = [new IndividualModel('v-ui:Preferences')];
    this.preferences['rdfs:label'] = ['Preferences_' + this.id];
    this['v-ui:hasPreferences'] = [this.preferences];
    return this.preferences;
  }
};

proto.initLanguage = function (preferences) {
  const setLanguage = () => {
    preferences.language = preferences['v-ui:preferredLanguage'].reduce( function (acc, lang) {
      acc[lang.id.substr(lang.id.indexOf(':') + 1)] = lang;
      return acc;
    }, {});
    veda.trigger('language:changed');
  };
  const setDisplayedElements = function () {
    preferences.displayedElements = preferences['v-ui:displayedElements'][0] || 10;
  };
  const updatePreferences = () => {
    if ( this.id !== 'cfg:Guest' ) {
      return preferences.save();
    }
  };
  if ( !preferences.hasValue('v-ui:preferredLanguage') || !preferences.hasValue('v-ui:displayedElements')) {
    const defaultDisplayedElements = 10;
    const defaultLanguage = new IndividualModel('v-ui:RU');
    preferences['v-ui:preferredLanguage'] = [defaultLanguage];
    preferences['v-ui:displayedElements'] = [defaultDisplayedElements];
  }
  preferences.on('v-ui:preferredLanguage', setLanguage);
  preferences.on('v-ui:displayedElements', setDisplayedElements);
  preferences.on('v-ui:preferredLanguage v-ui:displayedElements', updatePreferences);
  setLanguage();
  setDisplayedElements();
  return updatePreferences();
};
