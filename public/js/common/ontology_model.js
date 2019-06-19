// Ontology Model

veda.Module(function (veda) { "use strict";

  veda.OntologyModel = function () {

    // Singleton pattern
    if (veda.OntologyModel.prototype._singletonInstance) {
      return veda.OntologyModel.prototype._singletonInstance;
    }

    this.ontology = [];
    this.ontologies = {};
    this.datatypes = {};
    this.classes = {};
    this.properties = {};
    this.specifications = {};
    this.models = {};
    this.classTree = {};

    return veda.OntologyModel.prototype._singletonInstance = this;
  };

  var proto = veda.OntologyModel.prototype;

  proto.init = function () {
    return this.getOntology()
      .then(function (self) {
        return self.processOntology();
      })
      .catch(function (error) {
        var notify = veda.Notify();
        notify("danger", {code: "Ontology load error.", name: error});
        return error;
      });
  };

  proto.getClassProperties = function (_class_uri) {
    var classTree = this.classTree;
    return veda.Util.unique( getProps(_class_uri) );

    function getProps (_class_uri) {
      var _class = classTree[_class_uri];
      var props;
      if (_class) {
        props = _class.properties;
        return [].concat.apply( props, _class.superClasses.map( getProps ) );
      } else {
        return getProps("rdfs:Resource");
      }
    };
  };

  proto.getClassSpecifications = function (_class_uri) {
    var classTree = this.classTree;
    return getSpecs(_class_uri);

    function getSpecs (_class_uri) {
      var _class = classTree[_class_uri];
      var specs;
      if (_class) {
        specs = _class.specifications;
        var superSpecsArray = _class.superClasses.map( getSpecs );
        superSpecsArray.map( function (superSpecs) {
          for (var property_uri in superSpecs) {
            if ( !specs[property_uri] ) {
              specs[property_uri] = superSpecs[property_uri];
            }
          }
        });
      } else {
        specs = getSpecs( "rdfs:Resource" );
      }
      return specs;
    }
  };

  proto.getOntology = function () {
    var self = this;
    return new Promise( function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.onload = function () {
        if (this.status == 200) {
          var ontology = JSON.parse(this.response, veda.Util.decimalDatetimeReviver);
          self.ontology = ontology;
          resolve( self );
        } else {
          reject( new Error(this) );
        }
      };
      xhr.onerror = function () {
        reject( new BackendError(this) );
      };
      xhr.open("GET", "/ontology.json", true);
      xhr.timeout = 120000;
      xhr.send();
    });
  };

  proto.processOntology = function () {
    var ontology = this.ontology;
    var ontologies = this.ontologies;
    var datatypes = this.datatypes;
    var classes = this.classes;
    var properties = this.properties;
    var specifications = this.specifications;
    var classTree = this.classTree;
    var models = this.models;

    // Allocate ontology objects
    var ontologyPromises = ontology.map( function (json) {
      if (JSON.stringify(json) === '{"@":""}') { return; }
      return new veda.IndividualModel( json, 1, false ).load();
    });
    return Promise.all(ontologyPromises).then(function (ontology) {
      ontology.forEach( function (individual) {
        if ( !individual ) { return; }
        var type = individual.properties["rdf:type"][0].data;
        var uri = individual.id;

        switch ( type ) {
          case "rdfs:Class" :
          case "owl:Class" :
            classes[uri] = individual;
            break;
          case "rdf:Property" :
          case "owl:DatatypeProperty" :
          case "owl:ObjectProperty" :
          case "owl:OntologyProperty" :
          case "owl:AnnotationProperty" :
            properties[uri] = individual;
            // Initialize individual properties in {veda.IndividualModel.prototype}
            if ( !veda.IndividualModel.prototype.hasOwnProperty(uri) ) {
              veda.IndividualModel.defineProperty(uri);
            }
            break;
          case "v-ui:PropertySpecification" :
          case "v-ui:DatatypePropertySpecification" :
          case "v-ui:ObjectPropertySpecification" :
            specifications[uri] = individual;
            break;
          case "owl:Ontology" :
            ontologies[uri] = individual;
            break;
          case "rdfs:Datatype" :
            datatypes[uri] = individual;
            break;
          case "v-ui:ClassModel" :
            models[uri] = individual;
            break;
        }
      });

      // Process classes
      Object.keys(classes).forEach( function (uri) {
        var _class = classes[uri];
        // populate classTree
        if ( !classTree[_class.id] ) {
          classTree[_class.id] = {
            superClasses: [],
            properties: [],
            specifications: {}
          };
        }
        // rdfs:Resource is a top level class
        if ( _class.id === "rdfs:Resource" ) { return; }
        // If class is not a subclass of another then make it a subclass of rdfs:Resource
        if ( !_class.hasValue("rdfs:subClassOf") ) {
          _class["rdfs:subClassOf"] = [ classes["rdfs:Resource"] ];
        }
        _class["rdfs:subClassOf"].map( function ( superClass ) {
          classTree[_class.id].superClasses.push( superClass.id );
        });
      });

      // Process properties
      Object.keys(properties).forEach( function (uri) {
        try {
          var property = properties[uri];
          if (!property["rdfs:domain"]) { return; }
          property["rdfs:domain"].map( function ( _class ) {
            classTree[_class.id].properties.push(property.id);
          });
        } catch (err) {
          console.error("Ontology init error, uri = %s", uri, err.name);
        }
      });

      // Process specifications
      Object.keys(specifications).forEach( function (uri) {
        try {
          var spec = specifications[uri];
          if (!spec["v-ui:forClass"]) { return; }
          spec["v-ui:forClass"].map( function ( _class ) {
            spec["v-ui:forProperty"].map( function (prop) {
              classTree[_class.id].specifications[prop.id] = spec.id;
            });
          });
        } catch (err) {
          console.error("Ontology init error, uri = %s", uri, err.name);
        }
      });

      // Init ontology individuals
      ontology.forEach( function (individual) {
        if ( !individual ) { return; }
        try {
          individual.init();
        } catch (error) {
          console.error("Ontology individual init error, uri = %s", individual.id, error);
        }
      });

    });
  };

});

//~ // Auto update ontology on change
//~ var ccus = new veda.UpdateService();
//~ ccus.then(function (ccus) {
  //~ ccus.subscribe("cfg:OntoVsn", function () {
    //~ var ontology = new veda.OntologyModel();
    //~ ontology.init();
    //~ console.log("Ontology reloaded!");
  //~ });
//~ });
