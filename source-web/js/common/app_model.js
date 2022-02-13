// Application model

import riot from '../common/lib/riot.js';

import OntologyModel from '../common/ontology_model.js';

import UserModel from '../common/user_model.js';

/**
 * Application model
 * @param {Object} manifest - app config
 * @return {AppModel}
 */
export default function AppModel (manifest) {
  riot.observable(this);

  this.manifest = manifest;
  this.ticket = this.ticket || '';
  this.ontology = {};

  // Load ontology
  this.init = function (user) {
    const ontology = new OntologyModel();
    return ontology.then((ontology) => {
      this.ontology = ontology;
      this.user = new UserModel(user);
      return this.user._init();
    });
  };

  return this;
};
