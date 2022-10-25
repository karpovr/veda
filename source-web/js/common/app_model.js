// Application model

import Ontology from '../common/ontology_model.js';

import User from '../common/user_model.js';

import riot from '../common/lib/riot.js';

/**
 * Application model
 * @param {Object} manifest - app config
 * @return {App}
 */
export default function App (manifest) {
  riot.observable(this);
  this.ticket = this.ticket || '';
  this.ontology = {};
  this.manifest = manifest;

  // Load ontology
  this.init = function (user) {
    const ontology = new Ontology();
    this.ontology = ontology;
    return ontology.init().then(() => {
      this.user = new User(user);
      return this.user._init();
    });
  };
}
