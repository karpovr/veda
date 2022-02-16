// Application model

import Ontology from '../common/ontology_model.js';

import User from '../common/user_model.js';

/**
 * Application model
 * @param {Object} manifest - app config
 * @return {App}
 */
export default function App (manifest) {
  this.ticket = this.ticket || '';
  this.ontology = {};
  this.manifest = manifest;

  // Load ontology
  this.init = function (user) {
    const ontology = new Ontology();
    return ontology.init().then((ontology) => {
      this.ontology = ontology;
      this.user = new User(user);
      return this.user._init();
    });
  };

  return this;
};
