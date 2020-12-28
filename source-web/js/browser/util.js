// Veda browser utility functions

'use strict';

import veda from '../common/veda.js';

import IndividualModel from '../common/individual_model.js';

import Backend from '../common/backend.js';

import Notify from '../browser/notify.js';

const Util = veda.Util || {};

export default veda.Util = Util;

Util.registerHandler = function (individual, template, event, handler) {
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

  const prefixer = function(value, prefixes) {
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
      prefixes[prefix] = expanded;
      return value;
    } else {
      return '<' + value + '>';
    }
  };

  let ttl = individualList.map(function (individual) {
    let individual_ttl = '';
    for ( const property in individual.properties ) {
      if (Object.hasOwnProperty.call(individual.properties, property)) {
        const resources = individual.properties[property];
        if (property === '@') {
          individual_ttl = resources + '\n' + individual_ttl;
          prefixer(resources, prefixes);
        } else {
          const values = resources.reduce(function (acc, resource) {
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
              value = '"' + resource.data + '"^^xsd:dateTime';
              prefixer('xsd:', prefixes);
              break;
            case 'String':
              if (/("|\n)/.test(resource.data)) {
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
  System.import('filesaver').then(function (module) {
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
  Promise.all([report.load(), jasperServerCfg.load()]).then(function (loaded) {
    const report = loaded[0];
    const jasperServerCfg = loaded[1];
    const jasperServerAddress = jasperServerCfg['rdf:value'][0];

    const form = document.createElement('form');
    form.setAttribute('method', 'post');
    form.setAttribute('action', jasperServerAddress + 'flow.html?_flowId=viewReportFlow&reportUnit=' + encodeURIComponent(report['v-s:reportPath'][0]) + '&output=' + encodeURIComponent(report['v-s:reportFormat'][0]) + '&documentId=' + encodeURIComponent(params.id) + '&ticket=' + veda.ticket);
    form.setAttribute('target', 'Report');

    Object.getOwnPropertyNames(params.properties).forEach(function (key) {
      if ( key !== '@' && params.hasValue(key) ) {
        const hiddenField = document.createElement('input');
        hiddenField.setAttribute('type', 'hidden');
        hiddenField.setAttribute('name', key.replace(':', '_'));
        const value = params.get(key).map(function (item) {
          return item instanceof IndividualModel ? item.id :
            item instanceof Date ? item.toISOString() :
              item;
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
  };
  const modal = $( $('#notification-modal-template').html() );
  modal.modal();
  $('body').append(modal);
  const container = $('.modal-body', modal);
  if (typeof individual === 'string') {
    individual = new IndividualModel(individual);
  }
  individual.present(container, template, mode);
  modal.find('#follow').click( function () {
    const resourceTemplate = modal.find('[resource]').first();
    const uri = resourceTemplate.attr('resource');
    const mode = resourceTemplate.data('mode');
    modal.modal('hide');
    riot.route( ['#', uri, '#main', undefined, mode].join('/') );
  });
  $('.action#cancel', modal).click(function () {
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
  $('.action#cancel', modal).click(function () {
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
  return individual.present(container, template, mode).then(function () {
    return new Promise(function (resolve, reject) {
      $('.modal-footer > .ok', modal).click(function () {
        resolve(true);
      });
      $('.modal-footer > .cancel', modal).click(function () {
        resolve(false);
      });
    });
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
    (template.data('mode') === 'edit' ? individual.isSync(false) || template.data('callModelMethod')('save') : Promise.resolve())
      .then(function () {
        const transform = new IndividualModel(transformId);
        return transform.load().then(function (transform) {
          return Util.buildStartFormByTransformation(individual, transform).then(function (startForm) {
            return Util.showModal(startForm, startFormTemplate, 'edit');
          });
        });
      })
      .catch(function (error) {
        const notify = new Notify();
        const sendError = new IndividualModel('v-s:SendError');
        sendError.load().then(function (sendError) {
          notify('danger', {name: sendError});
        });
        console.log('Save before send error:', error.stack);
        throw error;
      });
  } else {
    individual['v-wf:hasStatusWorkflow'] = [new IndividualModel('v-wf:ToBeSent')];
    template.data('callModelMethod')('save')
      .then(function () {
        template.closest('.modal').modal('hide').remove();
        const notify = new Notify();
        const sendSuccess = new IndividualModel('v-s:SendSuccess');
        sendSuccess.load().then(function (sendSuccess) {
          notify('success', {name: sendSuccess});
        });
      })
      .catch(function (error) {
        const notify = new Notify();
        const sendError = new IndividualModel('v-s:SendError');
        sendError.load().then(function (sendError) {
          notify('danger', {name: sendError});
        });
        console.log('Send error:', error.stack);
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
  return Promise.all(promises).then(function(loadedItems) {
    return Util.transformation(loadedItems[0].properties, loadedItems[1].properties);
  }).then(function (transformResult) {
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
function getSync(ticket, uri) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'get_individual?uri=' + uri + '&ticket=' + ticket, false);
  xhr.send();
  if (xhr.status === 200) {
    return JSON.parse(xhr.responseText, Util.decimalDatetimeReviver);
  } else {
    throw Error(xhr);
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

  const rules = Util.getValues(transform['v-wf:transformRule']);

  if (!rules.length) {
    return Promise.resolve();
  }

  return Backend.get_individuals(veda.ticket, rules).then(function (rules) {
    const out_data0 = {};

    let out_data0_el = {};

    /* PUT functions [BEGIN] */

    const putFieldOfObject = (function() {
      return function(name, field) {
        let out_data0_el_arr;

        out_data0_el_arr = out_data0_el[name];

        if (!out_data0_el_arr) {
          out_data0_el_arr = [];
        }

        out_data0_el_arr.push(individual[field]);

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const putUri = (function() {
      return function(name, value) {
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

    const setUri = function(name, value) {
      out_data0_el[name] = [
        {
          data: value,
          type: 'Uri',
        }];
    };

    const putString = (function() {
      return function(name, value) {
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

    const setString = (function() {
      return function(name, value) {
        const out_data0_el_arr = [];

        out_data0_el_arr.push(
          {
            data: value,
            type: 'String',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const setDatetime = (function() {
      return function(name, value) {
        const out_data0_el_arr = [];

        out_data0_el_arr.push(
          {
            data: value,
            type: 'Datetime',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();

    const putDatetime = (function() {
      return function(name, value) {
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

    const putBoolean = (function() {
      return function(name, value) {
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

    const setBoolean = (function() {
      return function(name, value) {
        const out_data0_el_arr = [];

        out_data0_el_arr.push(
          {
            data: value,
            type: 'Boolean',
          });

        out_data0_el[name] = out_data0_el_arr;
      };
    })();


    const putInteger = (function() {
      return function(name, value) {
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

    const setInteger = (function() {
      return function(name, value) {
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
        const objectContentStrValue = (function() {
          return function(name, value) {
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

          const putValue = (function() {
            return function(name) {
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

          const putValueFrom = (function() {
            return function(name, path, transform) {
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

          const putFrontValue = (function() {
            return function(name) {
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

          const putElement = (function() {
            return function() {
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
          const contentName = (function() {
            return function(name) {
              return iteratedObject[key2] == name;
            };
          })();

          const elementContentStrValue = (function() {
            return function(name, value) {
              if (iteratedObject[key2] !== name) {
                return false;
              }
              const str = element[0].data;
              if (str == value) {
                return true;
              } else {
                return false;
              }
            };
          })();
          /* Segregate functions [END] */

          const getElement = (function() {
            return function() {
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
                if (res == false) {
                  continue;
                }
              }

              if (segregateElement) {
                res = eval(segregateElement[0].data);
                if (res == false) {
                  continue;
                }
              }

              // 3. v-wf:aggregate
              let group_key;
              if (!grouping) {
                out_data0_el = {};
                out_data0_el['@'] = Util.genUri() + '-tr';
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
                    out_data0_el['@'] = Util.genUri() + '-tr';
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
  }).catch(function (error) {
    console.log(error);
  });
};
