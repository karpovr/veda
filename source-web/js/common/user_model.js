// User model

import veda from '../common/veda.js';

import IndividualModel from '../common/individual_model.js';

export default User;

/**
 * Application user
 * @param {string} uri
 * @return {User}
 */
function User (uri) {
  return IndividualModel.call(this, uri);
};

User.prototype = Object.create(IndividualModel.prototype);

User.prototype.constructor = User;

const proto = User.prototype;

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
  const aspect_id = this.id + '_aspect';
  const aspect = this.hasValue('v-s:hasAspect') ? this['v-s:hasAspect'][0] : new veda.IndividualModel(aspect_id);
  return aspect.load()
    .catch((error) => {
      console.log('personal aspect load error', error);
      const aspect = new IndividualModel(aspect_id);
      aspect['rdf:type'] = 'v-s:PersonalAspect';
      aspect['v-s:owner'] = this;
      aspect['rdfs:label'] = 'PersonalAspect_' + this.id;
      return this.id !== 'cfg:Guest' ? aspect.save() : aspect;
    })
    .catch((error) => {
      console.log('personal aspect save error', error);
      throw error;
    })
    .then((aspect) => {
      if (!this.hasValue('v-s:hasAspect')) {
        this['v-s:hasAspect'] = aspect;
      }
      this.aspect = aspect;
    });
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
  const preferences_id = this.id + '_pref';
  const preferences = this.hasValue('v-ui:hasPrefences') ? this['v-ui:hasPrefences'][0] : new veda.IndividualModel(preferences_id);
  return preferences.load()
    .catch((error) => {
      console.log('personal preferences load error', error);
      const preferences = new IndividualModel(preferences_id);
      preferences['v-s:owner'] = this;
      preferences['rdf:type'] = 'v-ui:Preferences';
      preferences['rdfs:label'] = 'Preferences_' + this.id;
      this['v-ui:hasPreferences'] = preferences;
      return this.id !== 'cfg:Guest' ? preferences.save() : preferences;
    })
    .catch((error) => {
      console.log('personal preferences save error', error);
      throw error;
    })
    .then((preferences) => {
      if (!this.hasValue('v-ui:hasPreferences')) {
        this['v-ui:hasPreferences'] = preferences;
      }
      this.preferences = preferences;
      return preferences;
    });
};

proto.initLanguage = function (preferences) {
  const setLanguage = () => {
    preferences.language = preferences['v-ui:preferredLanguage'].reduce((acc, lang) => {
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
  if (!preferences.hasValue('v-ui:preferredLanguage') || !preferences.hasValue('v-ui:displayedElements')) {
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
