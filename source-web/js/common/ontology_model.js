// Ontology model

import veda from '../common/veda.js';

import IndividualModel from '../common/individual_model.js';

import Backend from '../common/backend.js';

import Util from '../common/util.js';

export default Ontology;

/**
 * Ontology
 * @return {Ontology}
 */
function Ontology () {
  // Singleton pattern
  if (Ontology.prototype._singletonInstance) {
    return Ontology.prototype._singletonInstance;
  }
  Ontology.prototype._singletonInstance = this;

  this.ontology = [];
  this.ontologies = {};
  this.datatypes = {};
  this.classes = {};
  this.properties = {};
  this.specifications = {};
  this.models = {};
  this.classTree = {};
  this.templates = {};

  return this;
}

const proto = Ontology.prototype;

proto.init = function () {
  if (this.ontology.length) {
    return Promise.resolve(this);
  }
  if (typeof window !== 'undefined') {
    return fetch('/ontology.json', {
      mode: 'same-origin',
      cache: 'no-cache',
      credentials: 'same-origin',
    }).then((response) => {
      if (response.ok) {
        return response.json();
      }
      throw Error(response.status);
    }).then((ontologyJSON) => {
      this.ontology = ontologyJSON;
      return this.processOntology();
    }).catch((error) => {
      console.error('Ontology load failed');
      throw error;
    });
  } else {
    return Backend.query(veda.ticket, "'rdf:type' == 'owl:Ontology' || 'rdf:type' == 'rdfs:Class' || 'rdf:type' == 'rdf:Property' || 'rdf:type' == 'rdfs:Datatype' || 'rdf:type' == 'v-ui:PropertySpecification' || 'rdf:type' == 'v-ui:ClassModel'")
      .then((queryResult) => {
        const ontology_uris = queryResult.result;
        return Backend.get_individuals(veda.ticket, ontology_uris);
      })
      .then((ontology) => {
        this.ontology = ontology;
        console.log('Ontology length:', ontology.length);
        return this.processOntology();
      });
  }
};

proto.getClassProperties = function (_class_uri) {
  const classTree = this.classTree;
  const getProps = (uri) => {
    const _class = classTree[uri];
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
  const getSpecs = (uri) => {
    const _class = classTree[uri];
    let specs;
    if (_class) {
      specs = _class.specifications;
      const superSpecsArray = _class.superClasses.map( getSpecs );
      superSpecsArray.map((superSpecs) => {
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
  let classTemplates = this.templates[_class_uri];
  if (!classTemplates) {
    classTemplates = this.classes[_class_uri].get('v-ui:hasTemplate');
  }
  return classTemplates[0];
};

proto.processOntology = function () {
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
  const ontologyIndividuals = ontology.map((json) => {
    if (JSON.stringify(json) === '{"@":""}') {
      return;
    }
    return new IndividualModel(json, true, false);
  });

  ontologyIndividuals.forEach((individual) => {
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
      console.error('Ontology init failed, uri =', individual.id);
    }
  });

  // Process classes
  Object.keys(classes).forEach((uri) => {
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
      _class['rdfs:subClassOf'].map((superClass) => {
        classTree[_class.id].superClasses.push( superClass.id );
      });
    } catch (error) {
      console.error('Ontology init failed, uri =', uri);
    }
  });

  // Process properties
  Object.keys(properties).forEach((uri) => {
    try {
      const property = properties[uri];
      if (!property['rdfs:domain']) {
        return;
      }
      property['rdfs:domain'].map(( _class ) => {
        classTree[_class.id].properties.push(property.id);
      });
    } catch (error) {
      console.error('Ontology init failed, uri =', uri);
    }
  });

  // Process specifications
  Object.keys(specifications).forEach((uri) => {
    try {
      const spec = specifications[uri];
      if (!spec['v-ui:forClass']) {
        return;
      }
      spec['v-ui:forClass'].map((_class) => {
        spec['v-ui:forProperty'].map((prop) => {
          classTree[_class.id].specifications[prop.id] = spec.id;
        });
      });
    } catch (error) {
      console.error('Ontology init failed, uri =', uri);
    }
  });

  // Process template specifications
  Object.keys(templates).forEach((uri) => {
    try {
      templates[uri] = templates[uri].sort((cur, prev) => {
        if (cur.properties['v-s:loadPriority']) {
          if (prev.properties['v-s:loadPriority']) {
            return cur.properties['v-s:loadPriority'][0].data - prev.properties['v-s:loadPriority'][0].data;
          } else {
            return -1;
          }
        } else {
          return 1;
        }
      }).map((templateSpec) => templateSpec.properties['v-ui:defaultTemplate'][0].data);
    } catch (error) {
      console.error('Ontology init failed, uri =', uri);
    }
  });

  // Init ontology individuals
  const initPromises = ontologyIndividuals.map((individual, i) => {
    return individual.init()
      .catch((error) => console.error('Ontology individual init failed, uri =', individual.id));
  });

  if (typeof window !== 'undefined') {
    return Promise.all(initPromises).then(() => this);
  } else {
    return Promise.resolve(this);
  }
};
