// User Model

import veda from '../common/veda.js';

import IndividualModel from '../common/individual_model.js';

export default veda.UserModel = UserModel;

/**
 * Application user
 * @param {string} uri
 * @return {UserModel}
 */
function UserModel(uri) {
  const self = IndividualModel.call(this, uri);

  return self;
};

UserModel.prototype = Object.create(IndividualModel.prototype);

UserModel.prototype.constructor = UserModel;

const proto = UserModel.prototype;

proto._init = function () {
  const self = this;
  return this.load()
    .then(self.initAspect.bind(self))
    .then(self.initAppointment.bind(self))
    // ~ .then(self.initAppointments.bind(self))
    .then(self.initPreferences.bind(self))
    .then(self.initLanguage.bind(self))
    .then(function () {
      if ( self.id !== 'cfg:Guest' ) {
        return self.save();
      }
    })
    .catch(function (error) {
      console.log('User init error', error.stack);
    });
};

proto.initAspect = function () {
  const self = this;
  if ( self.hasValue('v-s:hasAspect') ) {
    self.aspect = self['v-s:hasAspect'][0];
    return self.aspect.load();
  } else {
    const aspect_id = self.id + '_aspect';
    return new IndividualModel(aspect_id).load().then(function(loadedAspect) {
      if (loadedAspect.hasValue('rdf:type', 'rdfs:Resource')) {
        self.aspect = new IndividualModel(aspect_id);
        self.aspect['rdf:type'] = [new IndividualModel('v-s:PersonalAspect')];
        self.aspect['v-s:owner'] = [self];
        self.aspect['rdfs:label'] = ['PersonalAspect_' + self.id];
        self['v-s:hasAspect'] = [self.aspect];
        if ( self.id !== 'cfg:Guest' ) {
          return self.aspect.save();
        }
      } else {
        self.aspect = loadedAspect;
        self['v-s:hasAspect'] = [self.aspect];
        return self.aspect;
      }
    });
  }
};

proto.initAppointment = function () {
  const self = this;
  if (self.hasValue('v-s:defaultAppointment')) {
    veda.appointment = self['v-s:defaultAppointment'][0];
  } else if (self.hasValue('v-s:hasAppointment')) {
    self['v-s:defaultAppointment'] = [self['v-s:hasAppointment'][0]];
    veda.appointment = self['v-s:defaultAppointment'][0];
  } else {
    return veda.appointment = undefined;
  }
  const setAppointment = () => {
    const appointment = this['v-s:defaultAppointment'][0];
    appointment.load().then(function (appointment) {
      veda.appointment = appointment;
    });
  };
  this.on('v-s:defaultAppointment', setAppointment);
  return veda.appointment.load();
};

// ~ proto.initAppointments = function () {
// ~ const self = this;
// ~ return veda.Backend.query({
// ~ ticket: veda.ticket,
// ~ query: '\'rdf:type\'===\'v-s:Appointment\' && \'v-s:employee\'===\'' + self.id + '\'',
// ~ }).then(function (result) {
// ~ const appointments_uris = result.result;
// ~ return Promise.all(
// ~ appointments_uris.map(function (appointment_uri) {
// ~ const appointment = new veda.IndividualModel(appointment_uri);
// ~ return appointment.load();
// ~ }),
// ~ );
// ~ }).then(function (appointments) {
// ~ self.set('v-s:hasAppointment', appointments);
// ~ return veda.appointments = appointments;
// ~ });
// ~ };

proto.initPreferences = function () {
  const self = this;
  if ( self.hasValue('v-ui:hasPreferences') ) {
    self.preferences = self['v-ui:hasPreferences'][0];
    return self.preferences.load();
  } else {
    const preferences_id = self.id + '_pref';
    self.preferences = new IndividualModel(preferences_id);
    self.preferences['v-s:owner'] = [self];
    self.preferences['rdf:type'] = [new IndividualModel('v-ui:Preferences')];
    self.preferences['rdfs:label'] = ['Preferences_' + self.id];
    self['v-ui:hasPreferences'] = [self.preferences];
    return self.preferences;
  }
};

proto.initLanguage = function (preferences) {
  const self = this;
  const setLanguage = function () {
    preferences.language = preferences['v-ui:preferredLanguage'].reduce( function (acc, lang) {
      acc[lang.id.substr(lang.id.indexOf(':') + 1)] = lang;
      return acc;
    }, {});
    veda.trigger('language:changed');
  };
  const setDisplayedElements = function () {
    preferences.displayedElements = preferences['v-ui:displayedElements'][0] || 10;
  };
  const updatePreferences = function () {
    if ( self.id !== 'cfg:Guest' ) {
      preferences.save();
    }
  };
  if ( !preferences.hasValue('v-ui:preferredLanguage') || !preferences.hasValue('v-ui:displayedElements')) {
    const defaultDisplayedElements = 10;
    const defaultLanguage = new IndividualModel('v-ui:RU');
    preferences['v-ui:preferredLanguage'] = [defaultLanguage];
    preferences['v-ui:displayedElements'] = [defaultDisplayedElements];
    updatePreferences();
  }
  preferences.on('v-ui:preferredLanguage', setLanguage);
  preferences.on('v-ui:displayedElements', setDisplayedElements);
  preferences.on('v-ui:preferredLanguage v-ui:displayedElements', updatePreferences);
  setLanguage();
  setDisplayedElements();
};
