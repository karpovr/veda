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
}

User.prototype = Object.create(IndividualModel.prototype);

User.prototype.constructor = User;

const proto = User.prototype;

proto.getLanguage = function () {
  return this.preferences && this.preferences.language ? Object.keys(this.preferences.language) : undefined;
};

proto._init = function () {
  return this.reset()
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
      console.error('User init failed');
    });
};

proto.initAspect = function () {
  const aspect_id = this.id + '_aspect';
  const aspect = this.hasValue('v-s:hasAspect') ? this['v-s:hasAspect'][0] : new IndividualModel(aspect_id);
  return aspect.reset()
    .catch((error) => {
      console.error('Personal aspect load failed');
      const newAspect = new IndividualModel(aspect_id);
      newAspect['rdf:type'] = 'v-s:PersonalAspect';
      newAspect['v-s:owner'] = this;
      newAspect['rdfs:label'] = 'PersonalAspect_' + this.id;
      newAspect['rdfs:comment'] = 'Create new aspect due to aspect load error\n' + error.stack;
      return this.id !== 'cfg:Guest' ? newAspect.save() : newAspect;
    })
    .catch((error) => {
      console.error('Personal aspect save failed');
      throw error;
    })
    .then((userAspect) => {
      if (!this.hasValue('v-s:hasAspect')) {
        this['v-s:hasAspect'] = userAspect;
      }
      this.aspect = userAspect;
    });
};

proto.initAppointment = function () {
  if (this.hasValue('v-s:defaultAppointment')) {
    veda.appointment = this['v-s:defaultAppointment'][0];
  } else if (this.hasValue('v-s:hasAppointment')) {
    this['v-s:defaultAppointment'] = [this['v-s:hasAppointment'][0]];
    veda.appointment = this['v-s:defaultAppointment'][0];
  } else {
    veda.appointment = undefined;
    return;
  }
  const setAppointment = () => {
    const appointment = this.hasValue('v-s:defaultAppointment') && this['v-s:defaultAppointment'][0];
    if (appointment) {
      appointment.reset().then(() => {
        veda.appointment = appointment;
      });
    }
    this.save();
  };
  this.on('v-s:defaultAppointment', setAppointment);
  return veda.appointment.reset();
};

proto.initPreferences = function () {
  const preferences_id = this.id + '_pref';
  const preferences = this.hasValue('v-ui:hasPrefences') ? this['v-ui:hasPrefences'][0] : new IndividualModel(preferences_id);
  return preferences.reset()
    .catch((error) => {
      console.error('Personal preferences load failed');
      const newPreferences = new IndividualModel(preferences_id);
      newPreferences['v-s:owner'] = this;
      newPreferences['rdf:type'] = 'v-ui:Preferences';
      newPreferences['rdfs:label'] = 'Preferences_' + this.id;
      this['v-ui:hasPreferences'] = newPreferences;
      return this.id !== 'cfg:Guest' ? newPreferences.save() : newPreferences;
    })
    .catch((error) => {
      console.error('Personal preferences save failed');
      throw error;
    })
    .then((userPreferences) => {
      if (!this.hasValue('v-ui:hasPreferences')) {
        this['v-ui:hasPreferences'] = userPreferences;
      }
      this.preferences = userPreferences;
      return userPreferences;
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
