import BrowserUtil from '/js/browser/util.js';
import CommonUtil from '/js/common/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';
import Backend from '/js/common/backend.js';
import vis from 'vis';
import 'contextmenu';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  // Create a network
  const root = individual;
  const nodes = new vis.DataSet();
  const edges = new vis.DataSet();
  const body = $('body');
  let select = {nodes: [], edges: []};
  const data = {
    nodes: nodes,
    edges: edges,
  };

  addNode(root).then(function () {
    addOutLinks(root.id);
    addInLinks(root.id);
  });

  const height = $('#copyright').offset().top - graph.offset().top - 50 + 'px';
  const options = {
    width: '100%',
    height: height,
    nodes: {
      shape: 'box',
    },
    edges: {
      arrows: 'to',
    },
    groups: {
      _class: {
        color: {
          border: 'green',
          background: 'lightgreen',
          highlight: {
            border: 'green',
            background: 'lightgreen',
          },
        },
      },
      datatypeProperty: {
        color: {
          border: 'goldenrod',
          background: 'gold',
          highlight: {
            border: 'goldenrod',
            background: 'gold',
          },
        },
      },
      objectProperty: {
        color: {
          border: 'darkorange',
          background: 'orange',
          highlight: {
            border: 'darkorange',
            background: 'orange',
          },
        },
      },
      template: {
        color: {
          border: 'darkviolet',
          background: 'violet',
          highlight: {
            border: 'darkviolet',
            background: 'violet',
          },
        },
      },
      specification: {
        color: {
          border: 'hotpink',
          background: 'lightpink',
          highlight: {
            border: 'hotpink',
            background: 'lightpink',
          },
        },
      },
      ontology: {
        color: {
          border: 'darkgreen',
          background: 'green',
          highlight: {
            border: 'darkgreen',
            background: 'green',
          },
        },
        fontColor: 'white',
      },
    },
    physics: {
      enabled: true,
      barnesHut: {
        gravitationalConstant: -4000,
        centralGravity: 0.1,
        springLength: 200,
        springConstant: 0.04,
        damping: 0.09,
      },
    },
  };

  let network;

  setTimeout(function () {
    network = new vis.Network(graph.get(0), data, options);
    network.on('doubleClick', onDoubleClick);
    network.on('select', onSelect);
  });

  // Buttons
  $('#export-ttl', template).click(function () {
    const list = nodes.get().map(function (item) {
      return item.individual;
    });
    BrowserUtil.exportTTL(list);
  });
  $('#freeze', template).click(function () {
    network.freezeSimulation = !network.freezeSimulation;
    $('i', this).toggleClass('glyphicon-pause glyphicon-play');
  });

  const graph = $('#graph', template);

  // Context menu for selected node
  graph.contextmenu({
    target: $('#individual-context-menu', template),
    before: function (e, element) {
      if (!select.nodes.length) return false;
      const id = select.nodes[0];
      const node = nodes.get(id);
      switch (node.group) {
      case '_class':
        this.target = $('#class-context-menu', template);
        break;
      case 'ontology':
        this.target = $('#ontology-context-menu', template);
        break;
      case 'datatypeProperty':
      case 'objectProperty':
        this.target = $('#property-context-menu', template);
        break;
      case 'template':
        this.target = $('#template-context-menu', template);
        break;
      case 'specification':
        this.target = $('#specification-context-menu', template);
        break;
      default:
        this.target = $('#individual-context-menu', template);
        break;
      }
      return true;
    },
    onItem: function (context, e) {
      const id = select.nodes[0];
      switch (e.target.id) {
      case 'out-links':
        addOutLinks(id);
        break;
      case 'in-links':
        addInLinks(id);
        break;
      case 'delete':
        nodes.remove(select.nodes);
        edges.remove(select.edges);
        select.nodes = select.edges = [];
        break;
      case 'delete-with-out':
        deleteWithOutLinks(id);
        select.nodes = select.edges = [];
        break;
      case 'delete-with-in':
        deleteWithInLinks(id);
        select.nodes = select.edges = [];
        break;
      case 'class-individuals':
        addInLinks(id, "'rdf:type'==='{id}'");
        break;
      case 'class-subclasses':
        addInLinks(id, "('rdf:type'==='owl:Class'||'rdf:type'==='rdfs:Class')&&'rdfs:subClassOf'==='{id}'");
        break;
      case 'class-properties':
        addInLinks(id, "'rdfs:domain'==='{id}'");
        break;
      case 'class-templates':
        addInLinks(id, "'rdf:type'==='v-ui:ClassTemplate'&&'v-ui:forClass'==='{id}'");
        break;
      case 'class-specifications':
        addInLinks(
          id,
          "('rdf:type'==='v-ui:PropertySpecification' || " +
              "'rdf:type'==='v-ui:DatatypePropertySpecification' || " +
              "'rdf:type'==='v-ui:ObjectPropertySpecification'" +
              ")&&'v-ui:forClass'==='{id}'",
        );
        break;
      case 'property-specifications':
        addInLinks(
          id,
          "('rdf:type'==='v-ui:PropertySpecification' || " +
              "'rdf:type'==='v-ui:DatatypePropertySpecification' || " +
              "'rdf:type'==='v-ui:ObjectPropertySpecification'" +
              ")&&'v-ui:forProperty'=='{id}'",
        );
        break;
      }
    },
  });

  function addNode (individual) {
    return individual.load().then(function (individual) {
      if (nodes.get(individual.id) === null) {
        const node = {
          id: individual.id,
          label: individual['rdf:type'][0].toString() + '\n' + individual.toString(),
          individual: individual,
        };
        if (individual['rdf:type'][0]) {
          switch (individual['rdf:type'][0].id) {
          case 'rdfs:Class':
          case 'owl:Class':
            node.group = '_class';
            break;
          case 'rdf:Property':
          case 'owl:ObjectProperty':
            node.group = 'objectProperty';
            break;
          case 'owl:DatatypeProperty':
          case 'owl:OntologyProperty':
          case 'owl:AnnotationProperty':
            node.group = 'datatypeProperty';
            break;
          case 'v-ui:ClassTemplate':
            node.group = 'template';
            break;
          case 'v-ui:PropertySpecification':
          case 'v-ui:DatatypePropertySpecification':
          case 'v-ui:ObjectPropertySpecification':
            node.group = 'specification';
            break;
          case 'owl:Ontology':
            node.group = 'ontology';
            break;
          default:
            node.group = 'individual';
            break;
          }
        }
        nodes.add([node]);
      }
    });
  }

  function addOutLinks (id) {
    const individual = nodes.get(id).individual;
    Object.getOwnPropertyNames(individual.properties).map(function (property_uri) {
      if (property_uri === '@') {
        return;
      }
      individual[property_uri].forEach(function (value) {
        if (value instanceof IndividualModel && value !== individual) {
          addNode(value).then(function () {
            const from = individual.id;
            const to = value.id;
            const label = new IndividualModel(property_uri)['rdfs:label'].map(CommonUtil.formatValue).join(' ');
            const options = {
              filter: function (item) {
                return item.from == from && item.to == to && item.label.toString() == label;
              },
            };
            if (!edges.get(options).length) {
              edges.add([
                {
                  from: from,
                  to: to,
                  label: label,
                },
              ]);
            }
          });
        }
      });
    });
  }

  function addInLinks (id, queryStr) {
    let q = queryStr || "'*'=='{id}'";
    q = q.replace('{id}', id);
    return Backend.query(veda.ticket, q).then(function (queryResult) {
      const uris = queryResult.result;
      return Backend.get_individuals(veda.ticket, uris).then(function (individualsJSONs) {
        individualsJSONs.forEach(function (individualJSON) {
          const res = new IndividualModel(individualJSON);
          addNode(res);
          const to = id;
          const from = res.id;
          Object.getOwnPropertyNames(res.properties).map(function (property_uri) {
            if (property_uri === '@') {
              return;
            }
            if (res.hasValue(property_uri, id)) {
              const label = new IndividualModel(property_uri)['rdfs:label'].map(CommonUtil.formatValue).join(' ');
              const options = {
                filter: function (item) {
                  return item.from === from && item.to === to && item.label.toString() === label;
                },
              };
              if (!edges.get(options).length) {
                edges.add([{from: from, to: to, label: label}]);
              }
            }
          });
        });
      });
    });
  }

  function deleteWithOutLinks (id) {
    nodes.remove(id);
    const nodesToRemove = [];
    const edgesToRemove = edges.get({
      filter: function (item) {
        if (item.from == id) {
          nodesToRemove.push(item.to);
        }
        return item.from == id || item.to == id;
      },
    });
    edges.remove(edgesToRemove);
    nodes.remove(nodesToRemove);
  }

  function deleteWithInLinks (id) {
    nodes.remove(id);
    const nodesToRemove = [];
    const edgesToRemove = edges.get({
      filter: function (item) {
        if (item.to == id) {
          nodesToRemove.push(item.from);
        }
        return item.from == id || item.to == id;
      },
    });
    edges.remove(edgesToRemove);
    nodes.remove(nodesToRemove);
  }

  // Event handlers
  function onSelect (selected) {
    select = selected;
    body.off('keydown', selectedKeydownHandler);
    body.one('keydown', selected, selectedKeydownHandler);
  }
  function selectedKeydownHandler (e) {
    if (e.which == 46) {
      nodes.remove(e.data.nodes);
      edges.remove(e.data.edges);
    }
    if (e.which == 73) {
      addInLinks(e.data.nodes[0]);
    }
    if (e.which == 79) {
      addOutLinks(e.data.nodes[0]);
    }
  }

  function onDoubleClick (selected) {
    if (!selected.nodes.length) return;
    const individual_uri = selected.nodes[0];
    const modalTmpl = $('#individual-modal-template').html();
    const modal = $(modalTmpl);
    const modalBody = $('.modal-body', modal);
    const individual = new IndividualModel(individual_uri);
    individual.present(modalBody);
    modal.one('remove', function (e) {
      modal.modal('hide');
    });
    modal.modal();
    $('#main').append(modal);
  }
};

export const html = `
  <div class="container-fluid sheet">
    <button type="button" id="freeze" class="btn btn-success"><i class="glyphicon glyphicon-pause"></i></button>
    <button type="button" id="export-ttl" class="btn btn-primary">
      <i class="glyphicon glyphicon-export"></i> <span about="v-ui:ExportToTTL" property="rdfs:label"></span>
    </button>

    <div id="graph"></div>

    <div id="individual-context-menu">
      <ul class="dropdown-menu" role="menu">
        <li role="presentation" class="dropdown-header">Индивид</li>
        <li role="presentation" class="divider"></li>
        <li><a tabindex="-1" id="out-links">Все исходящие ссылки</a></li>
        <li><a tabindex="-1" id="in-links">Все входящие ссылки</a></li>
        <li role="presentation" class="divider"></li>
        <li><a tabindex="-1" id="delete">Удалить</a></li>
        <li><a tabindex="-1" id="delete-with-out">Удалить с исходящими</a></li>
        <li><a tabindex="-1" id="delete-with-in">Удалить с входящими</a></li>
      </ul>
    </div>
    <div id="class-context-menu">
      <ul class="dropdown-menu" role="menu">
        <li role="presentation" class="dropdown-header">Класс</li>
        <li><a tabindex="-1" id="class-individuals">Все индивиды</a></li>
        <li><a tabindex="-1" id="class-subclasses">Все подклассы</a></li>
        <li><a tabindex="-1" id="class-properties">Свойства класса</a></li>
        <li><a tabindex="-1" id="class-templates">Шаблоны класса</a></li>
        <li><a tabindex="-1" id="class-specifications">Спецификации класса</a></li>
        <li role="presentation" class="divider"></li>
        <li><a tabindex="-1" id="out-links">Все исходящие ссылки</a></li>
        <li><a tabindex="-1" id="in-links">Все входящие ссылки</a></li>
        <li role="presentation" class="divider"></li>
        <li><a tabindex="-1" id="delete">Удалить</a></li>
        <li><a tabindex="-1" id="delete-with-out">Удалить с исходящими</a></li>
        <li><a tabindex="-1" id="delete-with-in">Удалить с входящими</a></li>
      </ul>
    </div>
    <div id="property-context-menu">
      <ul class="dropdown-menu" role="menu">
        <li role="presentation" class="dropdown-header">Свойство</li>
        <li><a tabindex="-1" id="property-specifications">Спецификации свойства</a></li>
        <li role="presentation" class="divider"></li>
        <li><a tabindex="-1" id="out-links">Все исходящие ссылки</a></li>
        <li><a tabindex="-1" id="in-links">Все входящие ссылки</a></li>
        <li role="presentation" class="divider"></li>
        <li><a tabindex="-1" id="delete">Удалить</a></li>
        <li><a tabindex="-1" id="delete-with-out">Удалить с исходящими</a></li>
        <li><a tabindex="-1" id="delete-with-in">Удалить с входящими</a></li>
      </ul>
    </div>
    <div id="ontology-context-menu">
      <ul class="dropdown-menu" role="menu">
        <li role="presentation" class="dropdown-header">Онтология</li>
        <li role="presentation" class="divider"></li>
        <li><a tabindex="-1" id="out-links">Все исходящие ссылки</a></li>
        <li><a tabindex="-1" id="in-links">Все входящие ссылки</a></li>
        <li role="presentation" class="divider"></li>
        <li><a tabindex="-1" id="delete">Удалить</a></li>
        <li><a tabindex="-1" id="delete-with-out">Удалить с исходящими</a></li>
        <li><a tabindex="-1" id="delete-with-in">Удалить с входящими</a></li>
      </ul>
    </div>
    <div id="template-context-menu">
      <ul class="dropdown-menu" role="menu">
        <li role="presentation" class="dropdown-header">Шаблон</li>
        <li role="presentation" class="divider"></li>
        <li><a tabindex="-1" id="out-links">Все исходящие ссылки</a></li>
        <li><a tabindex="-1" id="in-links">Все входящие ссылки</a></li>
        <li role="presentation" class="divider"></li>
        <li><a tabindex="-1" id="delete">Удалить</a></li>
        <li><a tabindex="-1" id="delete-with-out">Удалить с исходящими</a></li>
        <li><a tabindex="-1" id="delete-with-in">Удалить с входящими</a></li>
      </ul>
    </div>
    <div id="specification-context-menu">
      <ul class="dropdown-menu" role="menu">
        <li role="presentation" class="dropdown-header">Спецификация</li>
        <li role="presentation" class="divider"></li>
        <li><a tabindex="-1" id="out-links">Все исходящие ссылки</a></li>
        <li><a tabindex="-1" id="in-links">Все входящие ссылки</a></li>
        <li role="presentation" class="divider"></li>
        <li><a tabindex="-1" id="delete">Удалить</a></li>
        <li><a tabindex="-1" id="delete-with-out">Удалить с исходящими</a></li>
        <li><a tabindex="-1" id="delete-with-in">Удалить с входящими</a></li>
      </ul>
    </div>
  </div>
`;
