// Ontology Model

import veda from '../common/veda.js';

import IndividualModel from '../common/individual_model.js';

import Backend from '../common/backend.js';

import Util from '../common/util.js';

export default veda.OntologyModel = OntologyModel;

/**
 * Ontology
 * @return {OntologyModel}
 */
function OntologyModel () {
  // Singleton pattern
  if (OntologyModel.prototype._singletonInstance) {
    return OntologyModel.prototype._singletonInstance;
  }

  this.ontology = [];
  this.ontologies = {};
  this.datatypes = {};
  this.classes = {};
  this.properties = {};
  this.specifications = {};
  this.models = {};
  this.classTree = {};
  this.templates = {};

  return OntologyModel.prototype._singletonInstance = this.init();
};

const proto = OntologyModel.prototype;

proto.init = function () {
  const self = this;
  if (typeof window !== 'undefined') {
    return Backend.loadFile('/ontology.json')
      .then(function (ontologyJSON) {
        self.ontology = JSON.parse(ontologyJSON);
        return self.processOntology();
      })
      .catch(function (error) {
        console.log('Ontology load error.', error.stack);
        return error;
      });
  } else {
    return Backend.query(veda.ticket, '\'rdf:type\' == \'owl:Ontology\' || \'rdf:type\' == \'rdfs:Class\' || \'rdf:type\' == \'rdf:Property\' || \'rdf:type\' == \'rdfs:Datatype\' || \'rdf:type\' == \'v-ui:PropertySpecification\' || \'rdf:type\' == \'v-ui:ClassModel\'')
      .then(function (queryResult) {
        const ontology_uris = queryResult.result;
        return Backend.get_individuals(veda.ticket, ontology_uris);
      })
      .then(function (ontology) {
        self.ontology = ontology;
        console.log('Ontology length:', ontology.length);
        return self.processOntology();
      });
  }
};

proto.getClassProperties = function (_class_uri) {
  const classTree = this.classTree;
  const getProps = function (_class_uri) {
    const _class = classTree[_class_uri];
    let props;
    if (_class) {
      props = _class.properties;
      return [].concat.apply( props, _class.superClasses.map( getProps ) );
    } else {
      return getProps('rdfs:Resource');
    }
  };
  return Util.unique( getProps(_class_uri) );
};

proto.getClassSpecifications = function (_class_uri) {
  const classTree = this.classTree;
  const getSpecs = function (_class_uri) {
    const _class = classTree[_class_uri];
    let specs;
    if (_class) {
      specs = _class.specifications;
      const superSpecsArray = _class.superClasses.map( getSpecs );
      superSpecsArray.map( function (superSpecs) {
        for (const property_uri in superSpecs) {
          if ( !specs[property_uri] ) {
            specs[property_uri] = superSpecs[property_uri];
          }
        }
      });
    } else {
      specs = getSpecs( 'rdfs:Resource' );
    }
    return specs;
  };
  return getSpecs(_class_uri);
};

proto.getClassTemplate = function (_class_uri) {
  const classTemplates = this.templates[_class_uri];
  if (!classTemplates) return null;
  return classTemplates[0];
};

proto.processOntology = function () {
  const self = this;
  const ontology = this.ontology;
  const ontologies = this.ontologies;
  const datatypes = this.datatypes;
  const classes = this.classes;
  const properties = this.properties;
  const specifications = this.specifications;
  const classTree = this.classTree;
  const models = this.models;
  const templates = this.templates;

  // Allocate ontology objects
  const ontologyIndividuals = ontology.map( function (json) {
    if (JSON.stringify(json) === '{"@":""}') {
      return;
    }
    return new IndividualModel(json, 1, false);
  });

  ontologyIndividuals.forEach( function (individual) {
    try {
      if ( !individual ) {
        return;
      }
      const type = individual.properties['rdf:type'][0].data;
      const uri = individual.id;

      switch ( type ) {
      case 'rdfs:Class':
      case 'owl:Class':
        classes[uri] = individual;
        break;
      case 'rdf:Property':
      case 'owl:DatatypeProperty':
      case 'owl:ObjectProperty':
      case 'owl:OntologyProperty':
      case 'owl:AnnotationProperty':
        properties[uri] = individual;
        // Initialize individual properties in IndividualModel.prototype
        if ( !IndividualModel.prototype.hasOwnProperty(uri) ) {
          IndividualModel.defineProperty(uri);
        }
        break;
      case 'v-ui:PropertySpecification':
      case 'v-ui:DatatypePropertySpecification':
      case 'v-ui:ObjectPropertySpecification':
        specifications[uri] = individual;
        break;
      case 'owl:Ontology':
        ontologies[uri] = individual;
        break;
      case 'rdfs:Datatype':
        datatypes[uri] = individual;
        break;
      case 'v-ui:ClassModel':
        models[uri] = individual;
        break;
      case 'v-ui:TemplateSpecification':
        const forClass = individual.properties['v-ui:forClass'][0].data;
        if (templates[forClass]) {
          templates[forClass].push(individual);
        } else {
          templates[forClass] = [individual];
        }
        break;
      }
    } catch (error) {
      console.log('Ontology init error, uri =', individual.id, error.stack);
    }
  });

  // Process classes
  Object.keys(classes).forEach( function (uri) {
    try {
      const _class = classes[uri];
      // populate classTree
      if ( !classTree[_class.id] ) {
        classTree[_class.id] = {
          superClasses: [],
          properties: [],
          specifications: {},
        };
      }
      // rdfs:Resource is a top level class
      if ( _class.id === 'rdfs:Resource' ) {
        return;
      }
      // If class is not a subclass of another then make it a subclass of rdfs:Resource
      if ( !_class.hasValue('rdfs:subClassOf') ) {
        _class['rdfs:subClassOf'] = [classes['rdfs:Resource']];
      }
      _class['rdfs:subClassOf'].map( function ( superClass ) {
        classTree[_class.id].superClasses.push( superClass.id );
      });
    } catch (error) {
      console.log('Ontology init error, uri =', uri, error.stack);
    }
  });

  // Process properties
  Object.keys(properties).forEach( function (uri) {
    try {
      const property = properties[uri];
      if (!property['rdfs:domain']) {
        return;
      }
      property['rdfs:domain'].map( function ( _class ) {
        classTree[_class.id].properties.push(property.id);
      });
    } catch (error) {
      console.log('Ontology init error, uri =', uri, error.stack);
    }
  });

  // Process specifications
  Object.keys(specifications).forEach( function (uri) {
    try {
      const spec = specifications[uri];
      if (!spec['v-ui:forClass']) {
        return;
      }
      spec['v-ui:forClass'].map( function ( _class ) {
        spec['v-ui:forProperty'].map( function (prop) {
          classTree[_class.id].specifications[prop.id] = spec.id;
        });
      });
    } catch (error) {
      console.log('Ontology init error, uri =', uri, error.stack);
    }
  });

  // Process template specifications
  Object.keys(templates).forEach(function (uri) {
    try {
      templates[uri] = templates[uri].sort(function(cur, prev) {
        if (cur.properties['v-s:loadPriority']) {
          if (prev.properties['v-s:loadPriority']) {
            return cur.properties['v-s:loadPriority'][0].data - prev.properties['v-s:loadPriority'][0].data;
          } else {
            return -1;
          }
        } else {
          return 1;
        }
      }).map(function(templateSpec) {
        return templateSpec.properties['v-ui:defaultTemplate'][0].data;
      });
    } catch (error) {
      console.log('Ontology init error, uri =', uri, error.stack);
    }
  });

  // Init ontology individuals
  const initPromises = ontologyIndividuals.map( function (individual, i) {
    return individual.init()
      .catch(function (error) {
        console.log('Ontology individual init error, uri =', individual.id, error.stack);
      });
  });

  if (typeof window !== 'undefined') {
    return Promise.all(initPromises).then(function () {
      return self;
    });
  } else {
    return Promise.resolve(self);
  }
};

