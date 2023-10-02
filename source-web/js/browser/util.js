// Utilities

import veda from '../common/veda.js';
import IndividualModel from '../common/individual_model.js';
import Backend from '../common/backend.js';
import notify from '../browser/notify.js';
import riot from '../common/lib/riot.js';
import CommonUtil from '../common/util.js';

const Util = {};

export default Util;

Util.registerHandler = function (individual, event, template, handler) {
  individual.on(event, handler);
  template.one('remove', function () {
    individual.off(event, handler);
  });
};

// Escape function for css (jQuery) selectors
Util.escape4$ = function (str) {
  if (str) return str.replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, '\\$1');
  return str;
};

Util.toTTL = function (individualList, callback) {
  const prefixes = {};

  const prefixer = function (value, prefixesHash) {
    const reg_uri = /^([a-z-0-9]+:)[a-zA-Z0-9-_]*$/;
    const ontologies = veda.ontology.ontologies;
    const result = reg_uri.exec(value);
    const prefix = result ? result[1] : null;
    let expanded;
    if (prefix === 'dc') {
      expanded = 'http://purl.org/dc/elements/1.1/';
    } else if (prefix === 'grddl') {
      expanded = 'http://www.w3.org/2003/g/data-view#';
    } else if (ontologies[prefix]) {
      expanded = ontologies[prefix]['v-s:fullUrl'][0].toString();
    }
    if (expanded) {
      prefixesHash[prefix] = expanded;
      return value;
    } else {
      return '<' + value + '>';
    }
  };

  let ttl = individualList.map((individual) => {
    let individual_ttl = '';
    for ( const property in individual.properties ) {
      if (Object.hasOwnProperty.call(individual.properties, property)) {
        const resources = individual.properties[property];
        if (property === '@') {
          individual_ttl = resources + '\n' + individual_ttl;
          prefixer(resources, prefixes);
        } else {
          const values = resources.reduce((acc, resource) => {
            let value;
            switch (resource.type) {
            case 'Boolean':
            case 'Integer':
            case 'Decimal':
              value = resource.data;
              break;
            case 'Uri':
              value = prefixer(resource.data, prefixes);
              break;
            case 'Datetime':
              if (resource.data instanceof Date) {
                value = '"' + resource.data.toISOString() + '"^^xsd:dateTime';
              } else {
                value = '"' + resource.data + '"^^xsd:dateTime';
              }
              prefixer('xsd:', prefixes);
              break;
            case 'String':
              if (/(["\n])/.test(resource.data)) {
                value = '"""' + resource.data + '"""';
              } else {
                value = '"' + resource.data + '"';
              }
              if (resource.lang !== undefined && resource.lang !== 'NONE') {
                value += '@' + resource.lang.toLowerCase();
              }
              break;
            }
            return acc.length ? acc + ', ' + value : value;
          }, '');
          individual_ttl += '  ' + property + ' ' + values + ' ;\n';
          prefixer(property, prefixes);
        }
      }
    }
    return individual_ttl + '.\n';
  }).join('\n');

  ttl = '\n' + ttl;

  for ( const prefix in prefixes ) {
    if (Object.hasOwnProperty.call(prefixes, prefix)) {
      ttl = ['@prefix', prefix, '<' + prefixes[prefix] + '>'].join(' ') + '.\n' + ttl;
    }
  }

  callback(undefined, ttl);
};

Util.exportTTL = function (individualList) {
  import('filesaver').then((module) => {
    const saveAs = module.default;
    Util.toTTL(individualList, function (error, result) {
      const blob = new Blob([result], {type: 'text/plain;charset=utf-8'});
      saveAs(blob, 'exported_graph.ttl');
    });
  });
};

/**
 * Create specified report
 * @param {string} report - uri of report to create
 * @param {Object} params - parameters to pass to report
 */
Util.createReport = function (report, params) {
  if (typeof report === 'string' || report instanceof String) {
    report = new IndividualModel(report);
  }
  const jasperServerCfg = new IndividualModel('cfg:jasperServerAddress');
  Promise.all([report.load(), jasperServerCfg.load()]).then((loaded) => {
    const reportIndividual = loaded[0];
    const jasperServerCfgIndividual = loaded[1];
    const jasperServerAddress = jasperServerCfgIndividual['rdf:value'][0];

    const form = document.createElement('form');
    form.setAttribute('method', 'post');
    form.setAttribute('action', jasperServerAddress + 'flow.html?_flowId=viewReportFlow&reportUnit=' + encodeURIComponent(reportIndividual['v-s:reportPath'][0]) + '&output=' + encodeURIComponent(reportIndividual['v-s:reportFormat'][0]) + '&documentId=' + encodeURIComponent(params.id) + '&ticket=' + veda.ticket);
    form.setAttribute('target', 'Report');

    Object.getOwnPropertyNames(params.properties).forEach((key) => {
      if ( key !== '@' && params.hasValue(key) ) {
        const hiddenField = document.createElement('input');
        hiddenField.setAttribute('type', 'hidden');
        hiddenField.setAttribute('name', key.replace(':', '_').replace('-', '_'));
        const value = params.get(key).map((item) => {
          if (item instanceof IndividualModel) {
            return item.id;
          } else if (item instanceof Date) {
            return item.toISOString();
          } else {
            return item;
          }
        }).join(',');
        hiddenField.setAttribute('value', value);
        form.appendChild(hiddenField);
      }
    });
    // Set client timezone parameter
    const tz = (new Date()).getTimezoneOffset();
    const tzField = document.createElement('input');
    tzField.setAttribute('type', 'hidden');
    tzField.setAttribute('name', 'timezone');
    tzField.setAttribute('value', tz);
    form.appendChild(tzField);
    document.body.appendChild(form);
    window.open('', 'Report');
    form.submit();
  });
};

/**
 * Show user's rights for individual
 * @param {IndividualModel} individual - authorization subject
 */
Util.showRights = function (individual) {
  const modalTmpl = $('#individual-modal-template').html();
  const modal = $(modalTmpl);
  const modalBody = $('.modal-body', modal);
  modal.modal();
  modal.on('hidden.bs.modal', function () {
    modal.remove();
  });
  $('body').append(modal);
  individual.present(modalBody, 'v-ui:PermissionsTemplate');
};

Util.showModal = function (individual, template, mode) {
  if ( $('body').hasClass('modal-open')) {
    $('.modal').modal('hide').remove();
  }
  const modal = $( $('#notification-modal-template').html() );
  modal.modal();
  $('body').append(modal);
  const container = $('.modal-body', modal);
  if (typeof individual === 'string') {
    individual = new IndividualModel(individual);
  }
  individual.present(container, template, mode);
  modal.find('#follow').on('click', () => {
    const resourceTemplate = modal.find('[resource]').first();
    const uri = resourceTemplate.attr('resource');
    const templateMode = resourceTemplate.attr('data-mode');
    modal.modal('hide');
    riot.route( ['#', uri, '#main', undefined, templateMode].join('/') );
  });
  $('.action#cancel', modal).on('click', () => {
    modal.modal('hide');
  });
  modal.on('hidden.bs.modal', function () {
    modal.remove();
  });
  return modal;
};

Util.showSmallModal = function (individual, template, mode) {
  const modal = $( $('#minimal-modal-template').html() );
  modal.modal();
  $('body').append(modal);
  const container = $('.modal-body', modal);
  individual.present(container, template, mode);
  $('.action#cancel', modal).on('click', () => {
    modal.modal('hide');
  });
  modal.on('hidden.bs.modal', function () {
    modal.remove();
  });
  return modal;
};

Util.confirm = function (individual, template, mode) {
  const modal = $( $('#confirm-modal-template').html() );
  modal.modal();
  modal.on('hidden.bs.modal', function () {
    modal.remove();
  });
  $('body').append(modal);
  const container = $('.modal-body', modal);
  return individual.present(container, template, mode).then(() => {
    return new Promise((resolve, reject) => {
      $('.modal-footer > .ok', modal).on('click', () => {
        resolve(true);
      });
      $('.modal-footer > .cancel', modal).on('click', () => {
        resolve(false);
      });
    });
  });
};

/**
 * Start BPMN process
 * @param {String} processDefinition
 * @param {IndividualModel} document
 * @return {void}
 */
Util.startProcess = function (processDefinition, document) {
  return processDefinition.load()
    .then(() => {
      const startFormClass = processDefinition['bpmn:hasStartFormClass'][0];
      if (!startFormClass) throw Error('start form class is not defined');
      const processDefinitionKey = processDefinition['bpmn:processDefinitionKey'][0];
      if (!processDefinitionKey) throw Error('processDefinitionKey is not defined');
      const startForm = new veda.IndividualModel();
      startForm['rdf:type'] = startFormClass;
      startForm['bpmn:hasStatus'] = 'bpmn:ToBeStarted';
      startForm['bpmn:processDefinitionKey'] = processDefinitionKey;
      if (document) startForm['bpmn:hasDocument'] = document;
      return Util.showModal(startForm, undefined, 'edit');
    })
    .catch((error) => {
      notify('danger', error);
      throw error;
    });
};

/**
 * Start workflow process
 *   - Apply transformation and redirect to start form.
 * @param {IndividualModel} individual
 * @param {template} template - reference to individual view where 'send' was invoked
 * @param {string} transformId - id of a transformation for start form
 * @param {string} _modal - obsolete
 * @param {string} startFormTemplate - id of a start form template
 * @return {void}
 */
Util.send = function (individual, template, transformId, _modal, startFormTemplate) {
  if ( transformId ) {
    return (!individual.isSync() ? template[0].veda.save() : Backend.get_individual(veda.ticket, individual.id).catch(() => template[0].veda.save()))
      .then(() => {
        const transform = new IndividualModel(transformId);
        return transform.load().then(() => {
          return Util.buildStartFormByTransformation(individual, transform).then((startForm) => {
            return Util.showModal(startForm, startFormTemplate, 'edit');
          });
        });
      })
      .catch((error) => {
        const sendError = new IndividualModel('v-s:SendError');
        sendError.load().then(() => {
          notify('danger', {name: sendError.toString()});
        });
        console.error('Save before send failed');
        throw error;
      });
  } else {
    individual['v-wf:hasStatusWorkflow'] = [new IndividualModel('v-wf:ToBeSent')];
    return template[0].veda.save()
      .then(() => {
        template.closest('.modal').modal('hide').remove();
        const sendSuccess = new IndividualModel('v-s:SendSuccess');
        sendSuccess.load().then(() => {
          notify('success', {name: sendSuccess.toString()});
        });
      })
      .catch((error) => {
        const sendError = new IndividualModel('v-s:SendError');
        sendError.load().then(() => {
          notify('danger', {name: sendError.toString()});
        });
        console.error('Send failed');
        throw error;
      });
  }
};

/**
 * Build start form using transformation
 * @param {IndividualModel} individual - individual to transform
 * @param {IndividualModel} transformation - transformation individual
 * @return {IndividualModel} - start form
 */
Util.buildStartFormByTransformation = function (individual, transformation) {
  const promises = [individual.load(), transformation.load()];
  return Promise.all(promises).then((loadedItems) => {
    return Util.transformation(loadedItems[0].properties, loadedItems[1].properties);
  }).then((transformResult) => {
    const startForm = new IndividualModel(transformResult[0]);
    startForm.isNew(true);
    startForm.isSync(false);
    return startForm.init();
  });
};

/**
 * Synchronous get individual
 * @param {string} ticket
 * @param {string} uri
 * @return {Object} - individual properties object
 */
function getSync (ticket, uri) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'get_individual?uri=' + uri + '&ticket=' + ticket, false);
  xhr.send();
  if (xhr.status === 200) {
    return JSON.parse(xhr.responseText);
  } else {
    throw Error(xhr.status);
  }
}

/**
 * Трансформировать указанные индивидуалы по заданным правилам
 * @param {string|IndividualModel} individuals - один или несколько IndividualModel или их идентификаторов
 * @param {string|IndividualModel} transform - применяемая трансформация
 * @return {Array}
 */
Util.transformation = function (individuals, transform) {
  if ( !Array.isArray(individuals) ) {
    individuals = [individuals];
  }

  const rulesUris = transform['v-wf:transformRule'].map((rule) => rule.data);

  if (!rulesUris.length) {
    return Promise.resolve();
  }

  return Backend.get_individuals(veda.ticket, rulesUris).then((rules) => {
    const out_data0 = {};

    let out_data0_el = {};

    /* PUT functions [BEGIN] */

    const putFieldOfObject = (() => {
      return function (name, field) {
        let out_data0_el_arr;

        out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        out_data0_el_arr.push(individual[field]);

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const putUri = (() => {
      return function (name, value) {
        let out_data0_el_arr;

        out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        out_data0_el_arr.push(
          {
            data: value,
            type: 'Uri',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const setUri = function (name, value) {
      out_data0_el[name] = [
        {
          data: value,
          type: 'Uri',
        }];
    };

    const putString = (() => {
      return function (name, value) {
        let out_data0_el_arr;

        out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        out_data0_el_arr.push(
          {
            data: value,
            type: 'String',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const setString = (() => {
      return function (name, value) {
        const out_data0_el_arr = [];

        out_data0_el_arr.push(
          {
            data: value,
            type: 'String',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const setDatetime = (() => {
      return function (name, value) {
        const out_data0_el_arr = [];

        out_data0_el_arr.push(
          {
            data: value,
            type: 'Datetime',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const putDatetime = (() => {
      return function (name, value) {
        let out_data0_el_arr;

        out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        out_data0_el_arr.push(
          {
            data: value,
            type: 'Datetime',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const putBoolean = (() => {
      return function (name, value) {
        let out_data0_el_arr;

        out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        out_data0_el_arr.push(
          {
            data: value,
            type: 'Boolean',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const setBoolean = (() => {
      return function (name, value) {
        const out_data0_el_arr = [];

        out_data0_el_arr.push(
          {
            data: value,
            type: 'Boolean',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();


    const putInteger = (() => {
      return function (name, value) {
        let out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        out_data0_el_arr.push(
          {
            data: value,
            type: 'Integer',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const setInteger = (() => {
      return function (name, value) {
        const out_data0_el_arr = [];

        out_data0_el_arr.push(
          {
            data: value,
            type: 'Integer',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    /* PUT functions [END] */

    for (const key in individuals) {
      if (Object.hasOwnProperty.call(individuals, key)) {
        // print("#1 key=", key);
        const individual = individuals[key];

        // print("#1.1 key=", key);
        const objectContentStrValue = (() => {
          return function (name, value) {
            if (individual[name]) {
              let result = false;
              for (const i in individual[name]) {
                if (value === individual[name][i].data) {
                  result = true;
                }
              }
              return result;
            }
          };
        })();

        const iteratedObject = Object.keys(individual);

        for (let key2 = 0; key2 < iteratedObject.length; key2++) {
          const element = individual[iteratedObject[key2]];

          const putValue = (() => {
            return function (name) {
              let out_data0_el_arr = out_data0_el[name];

              if (!out_data0_el_arr) {
                out_data0_el_arr = [];
              }

              if (iteratedObject[key2] == '@') {
                out_data0_el_arr.push(
                  {
                    data: element,
                    type: 'Uri',
                  });
              } else {
                if (Array.isArray(element) === true) {
                  for (const key3 in element) {
                    if (Object.hasOwnProperty.call(element, key3)) {
                      out_data0_el_arr.push(element[key3]);
                    }
                  }
                } else {
                  out_data0_el_arr.push(element);
                }
              }

              out_data0_el[name] = out_data0_el_arr;
            };
          })();

          const putValueFrom = (() => {
            return function (name, path, transform) {
              let out_data0_el_arr = out_data0_el[name];
              if (!out_data0_el_arr) {
                out_data0_el_arr = [];
              }

              let element_uri;

              if (Array.isArray(element) === true) {
                element_uri = Util.getUri(element);
              } else {
                element_uri = element.data ? element.data : element;
              }

              let curelem;

              curelem = getSync(veda.ticket, element_uri);

              for (let i = 0; i < path.length - 1; i++) {
                if (!curelem || !curelem[path[i]]) return;
                const uri = Array.isArray(curelem[path[i]]) && curelem[path[i]][0].data ? curelem[path[i]][0].data : curelem[path[i]];
                curelem = getSync(veda.ticket, uri);
              }
              if (!curelem || !curelem[path[path.length - 1]]) return;

              out_data0_el_arr = out_data0_el_arr.concat(curelem[path[path.length - 1]]);

              out_data0_el[name] = out_data0_el_arr;
            };
          })();

          const putFrontValue = (() => {
            return function (name) {
              let out_data0_el_arr = out_data0_el[name];

              if (!out_data0_el_arr) {
                out_data0_el_arr = [];
              }
              if (iteratedObject[key2] == '@') {
                out_data0_el_arr.unshift(
                  {
                    data: element,
                    type: 'Uri',
                  });
              } else {
                if (Array.isArray(element) === true) {
                  for (const key3 in element) {
                    if (Object.hasOwnProperty.call(element, key3)) {
                      out_data0_el_arr.unshift(element[key3]);
                    }
                  }
                } else {
                  out_data0_el_arr.unshift(element);
                }
              }

              out_data0_el[name] = out_data0_el_arr;
            };
          })();

          const putElement = (() => {
            return function () {
              const name = iteratedObject[key2];
              if (name == '@') {
                return;
              }

              let out_data0_el_arr = [];
              out_data0_el_arr = out_data0_el[name];

              if (!out_data0_el_arr) {
                out_data0_el_arr = [];
              }

              if (Array.isArray(element) === true) {
                for (const key3 in element) {
                  if (Object.hasOwnProperty.call(element, key3)) {
                    out_data0_el_arr.push(element[key3]);
                  }
                }
              } else {
                out_data0_el_arr.push(element);
              }

              out_data0_el[name] = out_data0_el_arr;
            };
          })();

          /* Segregate functions [BEGIN] */
          const contentName = (() => {
            return function (name) {
              return iteratedObject[key2] == name;
            };
          })();

          const elementContentStrValue = (() => {
            return function (name, value) {
              if (iteratedObject[key2] !== name) {
                return false;
              }
              const str = element[0].data;
              return str == value;
            };
          })();
          /* Segregate functions [END] */

          const getElement = (() => {
            return function () {
              return element;
            };
          })();


          // выполняем все rules
          for (const key3 in rules) {
            if (Object.hasOwnProperty.call(rules, key3)) {
              const rule = rules[key3];
              // 1. v-wf:segregateObject
              const segregateObject = rule['v-wf:segregateObject'];

              // 2. v-wf:segregateElement
              const segregateElement = rule['v-wf:segregateElement'];
              const grouping = rule['v-wf:grouping'];

              let res = undefined;

              if (segregateObject) {
                res = eval(segregateObject[0].data);
                if (!res) {
                  continue;
                }
              }

              if (segregateElement) {
                res = eval(segregateElement[0].data);
                if (!res) {
                  continue;
                }
              }

              // 3. v-wf:aggregate
              let group_key;
              if (!grouping) {
                out_data0_el = {};
                out_data0_el['@'] = CommonUtil.genUri() + '-tr';
              } else {
                let useExistsUid = false;
                for (const i in grouping) {
                  if (Object.hasOwnProperty.call(grouping, i)) {
                    const gk = grouping[i].data;
                    if (gk == '@') {
                      useExistsUid = true;
                    } else {
                      group_key = gk;
                    }
                  }
                }

                out_data0_el = out_data0[group_key];
                if (!out_data0_el) {
                  out_data0_el = {};
                  if (useExistsUid) {
                    out_data0_el['@'] = individual['@'];
                  } else {
                    out_data0_el['@'] = CommonUtil.genUri() + '-tr';
                  }
                }
              }

              const agregate = rule['v-wf:aggregate'];
              for (let i2 = 0; i2 < agregate.length; i2++) {
                eval(agregate[i2].data);
              }

              if (!grouping) {
                out_data0[out_data0_el['@']] = out_data0_el;
              } else {
                out_data0[group_key] = out_data0_el;
              }
            }
          }
        }
      }
    }

    const out_data = [];
    for (const key in out_data0) {
      if (Object.hasOwnProperty.call(out_data0, key)) {
        out_data.push(out_data0[key]);
      }
    }

    return out_data;
  }).catch((error) => {
    console.error('Transformation failed');
  });
};
