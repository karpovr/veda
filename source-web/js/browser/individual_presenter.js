// Individual Presenter

'use strict';

import veda from '../common/veda.js';

import IndividualModel from '../common/individual_model.js';

import Backend from '../common/backend.js';

import Util from '../common/util.js';

import '../browser/util.js';

import riot from '../common/lib/riot.js';

import Notify from '../browser/notify.js';

import '../browser/veda_controls.js';

import $ from 'jquery';

import 'jquery-ui';

import 'tablesortable';

IndividualModel.prototype.present = IndividualPresenter;

export default IndividualPresenter;

/**
 * Individual presenter method for IndividualModel class
 * @param {Element} container - container to render individual to
 * @param {IndividualModel|string} template - template to render individual with
 * @param {string} mode - view | edit | search
 * @param {Object} extra - extra parameters to pass ro template
 * @param {Boolean} toAppend - flag defining either to append or replace the container's content with rendered template
 * @return {Promise}
 */
function IndividualPresenter (container, template, mode, extra, toAppend) {
  mode = mode || 'view';

  toAppend = typeof toAppend !== 'undefined' ? toAppend : true;

  if (typeof container === 'string') {
    container = $(container);
  }

  const reg_uri = /^[a-z][a-z-0-9]*:([a-zA-Z0-9-_])*$/;
  const reg_file = /\.html$/;

  return this.load()
    .then(function (individual) {
      if (template) {
        if (template instanceof IndividualModel) {
        // if template is uri
        } else if (typeof template === 'string' && reg_uri.test(template) ) {
          template = new IndividualModel(template);
        } else {
          let templateString;
          if (typeof template === 'string') {
            templateString = template;
          } else if (template instanceof HTMLElement) {
            templateString = template.outerHTML;
          }
          return renderTemplate(individual, container, templateString, mode, extra, toAppend);
        }
        return template.load().then(function (template) {
          const templateString = template['v-ui:template'][0];
          if (reg_file.test(templateString)) {
            return veda.Backend.loadFile('/templates/' + templateString).then(function (templateString) {
              return renderTemplate(individual, container, templateString, mode, extra, toAppend);
            });
          } else {
            return renderTemplate(individual, container, templateString, mode, extra, toAppend);
          }
        });
      } else {
        const isClass = individual.hasValue('rdf:type', 'owl:Class') || individual.hasValue('rdf:type', 'rdfs:Class');
        let templatePromise;
        if ( individual.hasValue('v-ui:hasTemplate') && !isClass ) {
          template = individual['v-ui:hasTemplate'][0];
          templatePromise = template.load().then(function (template) {
            if ( !template.hasValue('rdf:type', 'v-ui:ClassTemplate') ) {
              throw new Error('Template type violation!');
            }
            const templateString = template['v-ui:template'][0].toString();
            if (reg_file.test(templateString)) {
              return veda.Backend.loadFile('/templates/' + templateString).then(function (templateString) {
                return renderTemplate(individual, container, templateString, mode, extra, toAppend);
              });
            } else {
              return renderTemplate(individual, container, templateString, mode, extra, toAppend);
            }
          });
        } else {
          const ontology = veda.ontology;

          const typePromises = individual['rdf:type'].map(function (type) {
            return type.load();
          });
          templatePromise = Promise.all(typePromises).then(function (types) {
            const templatesPromises = types.map( function (type) {
              const defaultTemplateUri = ontology.getClassTemplate(type.id);
              if (defaultTemplateUri) {
                return new IndividualModel(defaultTemplateUri).load();
              } else {
                return type.hasValue('v-ui:hasTemplate') ? type['v-ui:hasTemplate'][0].load() : new IndividualModel('v-ui:generic').load();
              }
            });
            return Promise.all(templatesPromises);
          }).then(function (templates) {
            const renderedTemplatesPromises = templates.map( function (template) {
              const templateString = template['v-ui:template'][0];
              if (reg_file.test(templateString)) {
                return veda.Backend.loadFile('/templates/' + templateString).then(function (templateString) {
                  return renderTemplate(individual, container, templateString, mode, extra, toAppend);
                });
              } else {
                return renderTemplate(individual, container, templateString, mode, extra, toAppend);
              }
            });
            return Promise.all(renderedTemplatesPromises);
          }).then(function (renderedTemplates) {
            return renderedTemplates.reduce(function (acc, renderedTemplate) {
              return acc.add(renderedTemplate);
            }, $());
          });
        }
        return templatePromise;
      }
    })
    .catch(errorHandler)
    .catch((error) => {
      const msg = $(`<div><code>${error.name} ${error.message} ${this.id}</code></div>`);
      container.append(msg);
      return msg;
    });
}

/**
 * Show success message
 * @param {Promise} result
 * @return {void}
 */
function successHandler (result) {
  const successMsg = new IndividualModel('v-s:SuccessBundle').load();
  successMsg.then((successMsg) => {
    const notify = new Notify();
    notify('success', {name: successMsg.toString()});
  }).catch(console.log);
  return result;
}

/**
 * Show error message
 * @param {Error} error to handle
 * @throw {Error}
 */
function errorHandler (error) {
  const errorMsg = new IndividualModel('v-s:ErrorBundle').load();
  errorMsg.then((errorMsg) => {
    const notify = new Notify();
    if (error.name + error.message) {
      notify('danger', error);
    } else {
      notify('danger', {name: errorMsg.toString()});
    }
  }).catch(console.log);
  throw error;
}

/**
 * Render template
 * @param {IndividualModel} individual - individual to render
 * @param {Element} container - container to render individual to
 * @param {IndividualModel|string} template - template to render individual with
 * @param {string} mode - view | edit | search
 * @param {Object} extra - extra parameters to pass ro template
 * @param {Boolean} toAppend - flag defining either to append or replace the container's content with rendered template
 * @return {Promise}
 */
function renderTemplate (individual, container, template, mode, extra, toAppend) {
  template = template.trim();

  // Extract pre script, template and post script
  const match = template.match(/^(?:<script[^>]*>([\s\S]*?)<\/script>)?([\s\S]*?)(?:<script[^>]*>(?![\s\S]*<script[^>]*>)([\s\S]*)<\/script>)?$/i);
  const pre_render_src = match[1];
  template = $( match[2] );
  const post_render_src = match[3];

  let pre_result;
  if (pre_render_src) {
    pre_result = eval('(function (){ \'use strict\'; ' + pre_render_src + '}).call(individual);');
  }

  return (pre_result instanceof Promise ? pre_result : Promise.resolve(pre_result)).then(function () {
    return processTemplate(individual, container, template, mode).then(function (processedTemplate) {
      processedTemplate.triggerHandler(mode);

      if (toAppend) {
        container.append(processedTemplate);
      }

      if (post_render_src) {
        eval('(function (){ \'use strict\'; ' + post_render_src + '}).call(individual);');
      }
      return processedTemplate;
    });
  });
}

/**
 * Process template
 * @param {IndividualModel} individual - individual to render
 * @param {Element} container - container to render individual to
 * @param {Element} template - template to render individual with
 * @param {string} mode - view | edit | search
 * @this Individual
 * @return {Promise}
 */
function processTemplate (individual, container, template, mode) {
  // Get properties specifications
  const ontology = veda.ontology;
  const specs = $.extend.apply(
    {}, [{}].concat(
      individual['rdf:type'].map( function (_class) {
        return ontology.getClassSpecifications(_class.id);
      }),
    ),
  );
  template.attr({
    'resource': individual.id,
    'typeof': individual['rdf:type'].map(function (item) {
      return item.id;
    }).join(' '),
  });

  const view = template.find('.view').addBack('.view');
  const edit = template.find('.edit').addBack('.edit');
  const search = template.find('.search').addBack('.search');
  const _view = template.find('.-view').addBack('.-view');
  const _edit = template.find('.-edit').addBack('.-edit');
  const _search = template.find('.-search').addBack('.-search');

  /**
   * Template mode handler. Applies mode to template to show/hide elements in different modes
   * @param {Event} event
   * @return {void}
   */
  const modeHandler = function (event) {
    event.stopPropagation();
    mode = event.type;
    template.data('mode', mode);
    switch (mode) {
    case 'view': view.show(); _view.hide(); break;
    case 'edit': edit.show(); _edit.hide(); break;
    case 'search': search.show(); _search.hide(); break;
    }
  };
  template.on('view edit search', modeHandler);

  // Embedded templates list
  const embedded = [];

  /**
   * Template mode handler. Triggers same events for embedded templates
   * @param {Event} event
   * @return {void}
   */
  const syncEmbedded = function (event) {
    embedded.map(function (item) {
      item.triggerHandler(event.type, individual.id);
    });
    event.stopPropagation();
  };
  template.on('view edit search', syncEmbedded);

  // Define handlers

  template.data({
    'reset': resetHandler,
    'save': saveHandler,
    'delete': deleteHandler,
    'recover': recoverHandler,
    'remove': removeHandler,
  });
  template.one('remove', function () {
    template.removeData('reset', 'save', 'delete', 'recover', 'remove');
  });
  template.on('cancel save delete recover destroy', function (e) {
    e.stopPropagation();
    if (e.type === 'cancel') {
      resetHandler();
    } else if (e.type === 'save') {
      saveHandler();
    } else if (e.type === 'delete') {
      deleteHandler();
    } else if (e.type === 'recover') {
      recoverHandler();
    } else if (e.type === 'destroy') {
      removeHandler();
    }
  });

  /**
   * Reset individual and embedded individuals
   * @param {string} parent id
   * @param {Array} acc for individuals uris
   * @return {Promise<void>}
   */
  function resetHandler (parent, acc) {
    acc = acc || [];
    acc = embedded.reduce((acc, item) => typeof item.data('reset') === 'function' ? item.data('reset')(individual.id, acc) : acc, acc);
    acc.push(individual.id);
    if (parent) {
      return acc;
    }
    const uris = Util.unique(acc);
    return uris.reduce((p, item) => p.then(() => new veda.IndividualModel(item).reset(true)), Promise.resolve())
      .then(() => template.triggerHandler('view'))
      .catch(errorHandler);
  }

  /**
   * Save individual and embedded children individuals
   * @param {string} parent id
   * @param {Array} acc for individuals uris
   * @return {Promise<void>}
   */
  function saveHandler (parent, acc) {
    acc = acc || [];
    acc = embedded.reduce((acc, item) => typeof item.data('save') === 'function' ? item.data('save')(individual.id, acc) : acc, acc);
    if (parent !== individual.id) {
      acc.push(individual.id);
    }
    if (parent) {
      return acc;
    }
    individual.isSync(false);
    const uris = Util.unique(acc);
    const individuals_properties = uris.map((item) => {
      const individual = new veda.IndividualModel(item);
      if (!individual.isSync()) {
        return individual.properties;
      }
    }).filter(Boolean);
    return Promise.all(individuals_properties.map((props) => new veda.IndividualModel(props['@']).trigger('beforeSave')))
      .then(() => Backend.put_individuals(veda.ticket, individuals_properties))
      .then(() => {
        individuals_properties.forEach((props) => {
          const individual = new veda.IndividualModel(props['@']);
          individual.isNew(false);
          individual.isSync(true);
          individual.isLoaded(true);
        });
      })
      .then(() => Promise.all(individuals_properties.map((props) => new veda.IndividualModel(props['@']).trigger('afterSave'))))
      .then(() => template.triggerHandler('view'))
      .then(successHandler)
      .catch(errorHandler);
  }

  /**
   * Delete individual and embedded children individuals
   * @param {string} parent id
   * @return {Promise<void>}
   */
  function deleteHandler () {
    return individual.delete()
      .then(() => template.triggerHandler('view'))
      .then(successHandler)
      .catch(errorHandler);
  }

  /**
   * Recover individual and embedded children individuals
   * @param {string} parent id
   * @return {Promise<void>}
   */
  function recoverHandler () {
    return individual.recover()
      .then(() => template.triggerHandler('view'))
      .then(successHandler)
      .catch(errorHandler);
  }

  /**
   * Remove individual and embedded children individuals
   * @param {string} parent id
   * @param {Array} acc for individuals uris
   * @return {Promise<void>}
   */
  function removeHandler (parent, acc) {
    acc = acc || [];
    acc = embedded.reduce((acc, item) => typeof item.data('remove') === 'function' ? item.data('remove')(individual.id, acc) : acc, acc);
    acc.push(individual.id);
    if (parent) {
      return acc;
    }
    const uris = Util.unique(acc);
    return uris.reduce((p, item) => p.then(() => new veda.IndividualModel(item).remove()), Promise.resolve())
      .then(() => {
        const removedAlert = new IndividualModel('v-s:RemovedAlert');
        removedAlert.load().then(function (removedAlert) {
          template.empty().append(`<code>${removedAlert.toString()}</code>`);
        }).catch(console.log);
      })
      .then(successHandler)
      .catch(errorHandler);
  }

  /**
   * Individual v-s:deleted handler. Shows deleted alert.
   * @this Individual
   * @return {void}
   */
  const deletedHandler = function () {
    if ( this.hasValue('v-s:deleted', true) ) {
      if ( container && typeof container.prop === 'function' && container.prop('id') === 'main' && !template.hasClass('deleted') ) {
        const alertModel = new IndividualModel('v-s:DeletedAlert');
        const recoverModel = new IndividualModel('v-s:Recover');
        Promise.all([alertModel.load(), recoverModel.load(), this.canUpdate()]).then(function (arr) {
          let alert = arr[0]['rdfs:label'].map(Util.formatValue).join(' ');
          const recover = arr[1]['rdfs:label'].map(Util.formatValue).join(' ');
          const canUpdate = arr[2];
          if (canUpdate) {
            alert = alert + '<button id="deleted-alert-recover" class="btn btn-primary btn-xs recover pull-right">' + recover + '</button>';
          }
          const deletedAlert = $(
            `<div id="deleted-alert" class="container sheet margin-lg">
              <div class="alert alert-warning no-margin clearfix" role="alert">
                <p id="deleted-alert-msg">${alert}</p>
              </div>
            </div>`,
          );
          $('.recover', deletedAlert).click(function () {
            template.triggerHandler('recover');
          });
          template.prepend(deletedAlert);
        });
      }
      if (mode !== 'search') {
        template.addClass('deleted');
      }
    } else {
      template.removeClass('deleted');
      if ( container && typeof container.prop === 'function' && container.prop('id') === 'main' ) {
        $('#deleted-alert', template).remove();
      }
    }
  };
  individual.on('v-s:deleted', deletedHandler);
  template.one('remove', function () {
    individual.off('v-s:deleted', deletedHandler);
  });
  deletedHandler.call(individual);

  /**
   * Individual v-s:valid handler. Shows alert whenb individual is invalid .
   * @this Individual
   * @return {void}
   */
  const validHandler = function () {
    if ( this.hasValue('v-s:valid', false) && !this.hasValue('v-s:deleted', true) && mode === 'view' ) {
      if ( (container.prop('id') === 'main' || container.hasClass('modal-body') ) && !template.hasClass('invalid') ) {
        new IndividualModel('v-s:InvalidAlert').load().then(function (loaded) {
          const alert = loaded['rdfs:label'].map(Util.formatValue).join(' ');
          const invalidAlert = $(
            `<div id="invalid-alert" class="container sheet margin-lg">
              <div class="alert alert-danger no-margin clearfix" role="alert">
                <p id="invalid-alert-msg">${alert}</p>
              </div>
            </div>`,
          );
          template.prepend(invalidAlert);
        });
      }
      template.addClass('invalid');
    } else {
      template.removeClass('invalid');
      if ( container.prop('id') === 'main' ) {
        $('#invalid-alert', template).remove();
      }
    }
  };
  individual.on('v-s:valid', validHandler);
  individual.on('v-s:deleted', validHandler);
  template.one('remove', function () {
    individual.off('v-s:valid', validHandler);
    individual.off('v-s:deleted', validHandler);
  });
  validHandler.call(individual);

  // Process RDFa compliant template

  // Special (not RDFa)
  template.find('[href*=\'@\']:not([rel] *):not([about] *)').addBack('[href*=\'@\']:not([rel] *):not([about] *)').map( function (i, el) {
    const self = $(el);
    const str = self.attr('href');
    self.attr('href', str.replace('@', individual.id));
  });

  template.find('[src*=\'@\']:not([rel] *):not([about] *)').addBack('[src*=\'@\']:not([rel] *):not([about] *)').map( function (i, el) {
    const self = $(el);
    const str = self.attr('src');
    self.attr('src', str.replace('@', individual.id));
  });

  template.find('[style*=\'@\']:not([rel] *):not([about] *)').addBack('[style*=\'@\']:not([rel] *):not([about] *)').map( function (i, el) {
    const self = $(el);
    const style = self.attr('style');
    self.attr('style', style.replace('@', individual.id));
  });

  template.find('[title]:not([rel] *):not([about] *)').addBack('[style*=\'@\']:not([rel] *):not([about] *)').map( function (i, el) {
    const self = $(el);
    const title = self.attr('title');
    if ( (/^(\w|-)+:.*?$/).test(title) ) {
      const titleIndividual = new IndividualModel(title);
      titleIndividual.load().then(function (titleIndividual) {
        self.attr('title', titleIndividual);
      });
    }
  });

  // Property values
  const props = template.find('[property]:not(veda-control):not([rel] *):not([about] *)').addBack('[property]:not(veda-control):not([rel] *):not([about] *)').map( function (i, el) {
    const propertyContainer = $(el);
    const property_uri = propertyContainer.attr('property');
    const about_uri = propertyContainer.attr('about');
    let about;
    let isAbout;

    if (about_uri === '@') {
      about = individual;
      isAbout = true;
      propertyContainer.attr('about', about.id);
    } else if (!about_uri) {
      about = individual;
      isAbout = false;
    } else {
      about = new IndividualModel(about_uri);
      isAbout = true;
    }

    return about.load().then(function (about) {
      const idModifiedHandler = function () {
        propertyContainer.text(about.id);
      };
      if (property_uri === '@') {
        propertyContainer.text(about.id);
        about.on('idChanged', idModifiedHandler);
        template.one('remove', function () {
          about.off('idChanged', idModifiedHandler);
        });
        return;
      }

      // Re-render all property values if model's property was changed
      const propertyModifiedHandler = function () {
        renderPropertyValues(about, isAbout, property_uri, propertyContainer, template, mode);
      };
      about.on(property_uri, propertyModifiedHandler);
      template.one('remove', function () {
        about.off(property_uri, propertyModifiedHandler);
      });

      renderPropertyValues(about, isAbout, property_uri, propertyContainer, template, mode);
    });
  }).get();

  // Max displayed values
  template.on('click', '.more', function (event) {
    event.stopPropagation();
    const $this = $(event.target);
    const resource_uri = $this.closest('[resource]').attr('resource');
    const resource = new IndividualModel(resource_uri);
    const relContainer = $this.closest('[rel]');
    const countDisplayed = relContainer.children().length - 1;// last children is .more button
    const rel_uri = relContainer.attr('rel');

    resource.triggerHandler(rel_uri, resource.get(rel_uri), countDisplayed + 10);
    $this.remove();
  });

  // Related resources & about resources
  const rels = template.find('[rel]:not(veda-control):not([rel] *):not([about] *)').addBack('[rel]:not(veda-control):not([rel] *):not([about] *)').map( function (i, el) {
    const relContainer = $(el);
    let about = relContainer.attr('about');
    const rel_uri = relContainer.attr('rel');
    const isEmbedded = relContainer.attr('data-embedded') === 'true';
    const spec = specs[rel_uri] ? new IndividualModel( specs[rel_uri] ) : undefined;
    const rel_inline_template = relContainer.html().trim();
    const rel_template_uri = relContainer.attr('data-template');
    let limit = relContainer.attr('data-limit') || Infinity;
    const more = relContainer.attr('data-more') || false;
    let relTemplate;
    let isAbout;

    const sortableOptions = {
      delay: 150,
      placeholder: 'sortable-placeholder',
      forcePlaceholderSize: true,
      handle: '.button-drag',
      cancel: '',
      update: function () {
        const uris = $(this).sortable('toArray', {attribute: 'resource'});
        individual.set(
          rel_uri,
          uris.map(function (uri) {
            return new IndividualModel(uri);
          }),
        );
      },
    };
    relContainer.sortable(sortableOptions);
    template.one('remove', function () {
      relContainer.sortable('destroy');
    });

    if (about) {
      isAbout = true;
      about = (about === '@' ? individual : new IndividualModel(about));
      relContainer.attr('about', about.id);
    } else {
      isAbout = false;
      about = individual;
    }

    if ( rel_template_uri ) {
      relTemplate = rel_template_uri;
    } else if ( rel_inline_template.length ) {
      relTemplate = rel_inline_template;
    }
    relContainer.empty();

    template.on('view edit search', function (e) {
      if (e.type === 'view') {
        relContainer.sortable('disable');
      } else if (e.type === 'edit') {
        relContainer.sortable('enable');
        const property = new IndividualModel(rel_uri);
        if ( isEmbedded &&
            spec &&
            spec['v-ui:minCardinality'][0] >= 1 &&
            !individual.hasValue(rel_uri) &&
            !(property.hasValue('rdfs:range') && property['rdfs:range'][0].id === 'v-s:File')
        ) {
          const valueType = spec && spec.hasValue('v-ui:rangeRestriction') ?
            spec['v-ui:rangeRestriction'] : property.hasValue('rdfs:range') ?
              property['rdfs:range'] : [];
          const emptyValue = new IndividualModel();
          if ( valueType.length ) {
            emptyValue['rdf:type'] = valueType;
          }
          individual.set(rel_uri, [emptyValue]);
        }
      } else if (e.type === 'search') {
        relContainer.sortable('enable');
      }
      e.stopPropagation();
    });

    return about.load().then(function (about) {
      const values = about.get(rel_uri);

      const propertyModifiedHandler = function (values, limit_param) {
        limit = limit_param || limit;
        relContainer.empty();

        return values.reduce((p, value, i) => {
          return p.then((templates) => {
            if (i < limit) {
              return renderRelationValue(about, isAbout, rel_uri, value, relContainer, relTemplate, template, mode, embedded, isEmbedded, false)
                .then((template) => templates.concat(template));
            } else {
              return templates;
            }
          });
        }, Promise.resolve([]))
          .then((templates) => {
            relContainer.append(templates);
            if (limit < values.length && more) {
              relContainer.append( '<a class=\'more badge\'>&darr; ' + (values.length - limit) + '</a>' );
            }
          });
      };

      const embeddedHandler = function (values) {
        if (mode === 'edit') {
          values.map(function (value) {
            if (
              value.id !== about.id && // prevent self parent
              rel_uri !== 'v-s:parent' && // prevent circular parent
              !value.hasValue('v-s:parent') // do not change parent
            ) {
              value['v-s:parent'] = [about];
              value['v-s:backwardTarget'] = [about];
              value['v-s:backwardProperty'] = [rel_uri];
              value['v-s:canRead'] = [true];
              value['v-s:canUpdate'] = [true];
              value['v-s:canDelete'] = [true];
            }
          });
        }
      };

      if (isEmbedded) {
        embeddedHandler(values);
        about.on(rel_uri, embeddedHandler);
        template.one('remove', function () {
          about.off(rel_uri, embeddedHandler);
        });
      }

      about.on(rel_uri, propertyModifiedHandler);
      template.one('remove', function () {
        about.off(rel_uri, propertyModifiedHandler);
      });

      return propertyModifiedHandler(values, limit);
    });
  }).get();

  // About resource
  const abouts = template.find('[about]:not([rel] *):not([about] *):not([rel]):not([property])').addBack('[about]:not([rel] *):not([about] *):not([rel]):not([property])').map( function (i, el) {
    const aboutContainer = $(el);
    const about_template_uri = aboutContainer.attr('data-template');
    const about_inline_template = aboutContainer.html().trim();
    const isEmbedded = aboutContainer.attr('data-embedded') === 'true';
    let about; let aboutTemplate;
    if ( about_template_uri ) {
      aboutTemplate = new IndividualModel( about_template_uri );
    } else if ( about_inline_template.length ) {
      aboutTemplate = about_inline_template;
    }
    aboutContainer.empty();
    if (aboutContainer.attr('about') === '@') {
      about = individual;
      aboutContainer.attr('about', about.id);
    } else {
      about = new IndividualModel(aboutContainer.attr('about'));
    }
    return about.present(aboutContainer, aboutTemplate, isEmbedded ? mode : undefined).then(function (aboutTemplate) {
      if (isEmbedded) {
        aboutTemplate.data('isEmbedded', true);
        embedded.push(aboutTemplate);
        if (mode === 'edit') {
          aboutTemplate.trigger('internal-validate');
        }
      }
    });
  }).get();

  // Validation with support of embedded templates (arbitrary depth)

  // Initial validation state
  const validation = {state: true};
  template.data('validation', validation);

  /**
   * Validate template handler
   * @param {Event} event - custom 'internal-validate' event
   * @return {void}
   */
  const validateTemplate = function (event) {
    event.stopPropagation();
    if (mode === 'edit') {
      Object.keys(validation).map( function (property_uri) {
        if (property_uri === 'state') {
          return;
        }
        const spec = specs[property_uri] ? new IndividualModel( specs[property_uri] ) : undefined;
        validation[property_uri] = validate(individual, property_uri, spec);
      });
      template.trigger('validate');
      validation.state = Object.keys(validation).reduce( function (acc, property_uri) {
        if (property_uri === 'state') {
          return acc;
        }
        return acc && validation[property_uri].state;
      }, true);
      validation.state = validation.state && embedded.reduce(function (acc, embeddedTemplate) {
        const embeddedValidation = embeddedTemplate.data('validation');
        return embeddedValidation ? acc && embeddedValidation.state : acc;
      }, true);
      template.trigger('internal-validated', [validation]);
    }
    // "validate" event should bubble up to be handled by parent template only if current template is embedded
    if ( template.data('isEmbedded') ) {
      container.trigger('internal-validate');
    }
  };
  template.on('internal-validate', validateTemplate);

  /**
   * Trigger 'internal-validate' event on individual property change or when mode switches to 'edit'
   * @return {void}
   */
  const triggerValidation = function () {
    if (mode === 'edit') {
      template.trigger('internal-validate');
    }
  };
  individual.on('propertyModified', triggerValidation);

  template.one('remove', function () {
    individual.off('propertyModified', triggerValidation);
  });
  template.on('edit', triggerValidation);

  /**
   * Merge validation result from custom template validation
   * @param {Event} event - custom 'validated' event
   * @param {Object} validationResult - validation result object
   * @return {void}
   */
  const mergeValidationResult = function (event, validationResult) {
    event.stopPropagation();
    if (mode === 'edit') {
      Object.keys(validationResult).map(function (property_uri) {
        if (property_uri === 'state') {
          return;
        }
        validation[property_uri] = validationResult[property_uri];
      });
      validation.state = Object.keys(validation).reduce( function (acc, property_uri) {
        if (property_uri === 'state') {
          return acc;
        }
        return acc && validation[property_uri].state;
      }, true);
      template.trigger('internal-validated', [validation]);
    }
  };

  // Handle validation events from template
  template.on('validate', (e) => e.stopPropagation());
  template.on('validated', mergeValidationResult);

  // Controls
  template.find('veda-control[property], veda-control[rel]').not('[rel] *').not('[about] *').map( function (i, el) {
    const control = $(el);
    const property_uri = control.attr('property') || control.attr('rel');
    const type = control.attr('data-type') || 'generic';
    const spec = specs[property_uri] ? new IndividualModel( specs[property_uri] ) : undefined;
    const controlType = $.fn['veda_' + type];

    // control.removeAttr("property").removeAttr("rel");

    // Initial validation state
    validation[property_uri] = {state: true, cause: []};

    const validatedHandler = function (e, validation) {
      if ( validation.state || !validation[property_uri] || validation[property_uri].state === true ) {
        control.removeClass('has-error');
        control.popover('destroy');
      } else {
        control.addClass('has-error');
        let explanation;
        if (validation[property_uri].message) {
          explanation = validation[property_uri].message;
        } else {
          const causesPromises = validation[property_uri].cause.map(function (cause_uri) {
            return new IndividualModel(cause_uri).load();
          });
          Promise.all(causesPromises).then(function (causes) {
            explanation = causes.map(function (cause) {
              return cause['rdfs:comment'].map(Util.formatValue).filter(Boolean).join(', ');
            }).join('\n');
          });
        }
        control.popover({
          content: function () {
            return explanation;
          },
          container: control,
          trigger: 'hover focus',
          placement: 'top',
          animation: false,
        });
        if ( $('input', control).is(':focus') ) {
          control.popover('show');
        }
      }
      e.stopPropagation();
    };
    template.on('internal-validated', validatedHandler);

    template.on('view edit search', function (e) {
      e.stopPropagation();
      control.triggerHandler(e.type);
    });

    const assignDefaultValue = function (e) {
      if ( spec && spec.hasValue('v-ui:defaultValue') && !individual.hasValue(property_uri) ) {
        individual.set(property_uri, spec['v-ui:defaultValue']);
      }
      e.stopPropagation();
    };
    template.on('edit', assignDefaultValue);

    const opts = {
      individual: individual,
      property_uri: property_uri,
      spec: spec,
      mode: mode,
    };

    controlType.call(control, opts);
  });

  const promises = rels.concat(abouts, props);
  return Promise.all(promises).then(function () {
    return template;
  });
}

/**
 * Render literal values of individual
 * @param {IndividualModel} about - individual
 * @param {Boolean} isAbout - is about flag
 * @param {string} property_uri - which property values to render
 * @param {Element} propertyContainer - where to render values
 * @param {Element} template - template reference
 * @param {string} mode - template mode
 * @return {void}
 */
function renderPropertyValues (about, isAbout, property_uri, propertyContainer, template, mode) {
  propertyContainer.empty();
  about.get(property_uri).map( function (value) {
    const formattedValue = Util.formatValue(value);
    if (isAbout) {
      const prevValue = propertyContainer.text();
      propertyContainer.text( prevValue ? prevValue + (formattedValue ? ' ' + formattedValue : '') : formattedValue );
    } else {
      const valueHolder = $('<span class=\'value-holder\'></span>');
      propertyContainer.append(valueHolder.text( Util.formatValue(value) ));
      const btnGroup = $('<div class=\'prop-actions btn-group btn-group-xs\' role=\'group\'></div>');
      const btnRemove = $('<button class=\'btn btn-default\' tabindex=\'-1\'><span class=\'glyphicon glyphicon-remove\'></span></button>');
      btnGroup.append(btnRemove);

      template.on('view edit search', function (e) {
        if (e.type === 'view') btnGroup.hide();
        else btnGroup.show();
        e.stopPropagation();
      });
      if (mode === 'view') {
        btnGroup.hide();
      }

      btnRemove.click(function () {
        about.removeValue( property_uri, value );
      }).mouseenter(function () {
        valueHolder.addClass('red-outline');
      }).mouseleave(function () {
        valueHolder.removeClass('red-outline');
      });
      valueHolder.append( btnGroup );
    }
  });
}

/**
 * Render related objects of individual
 * @param {IndividualModel} about - individual
 * @param {Boolean} isAbout - is about flag
 * @param {string} rel_uri - which relation values to render
 * @param {IndividualModel} value - value to render
 * @param {Element} relContainer - where to render the value
 * @param {Element} relTemplate - which template to user to render the value
 * @param {Element} template - template reference
 * @param {string} mode - template mode
 * @param {Array} embedded - embedded templates list
 * @param {Boolean} isEmbedded - flag to include rendered value to embedded list
 * @param {Boolean} toAppend - flag defining either to append or replace the relContainer's content with rendered value template
 * @return {void}
 */
function renderRelationValue (about, isAbout, rel_uri, value, relContainer, relTemplate, template, mode, embedded, isEmbedded, toAppend) {
  return value.present(relContainer, relTemplate, isEmbedded ? mode : undefined, undefined, toAppend).then(function (valTemplate) {
    if (isEmbedded) {
      valTemplate.data('isEmbedded', true);
      embedded.push(valTemplate);
      if (mode === 'edit') {
        valTemplate.trigger('internal-validate');
      }
      valTemplate.one('remove', function () {
        if (embedded.length) {
          const index = embedded.indexOf(valTemplate);
          if ( index >= 0 ) embedded.splice(index, 1);
        }
      });
    }
    if (!isAbout) {
      const btnGroup = $('<div class=\'rel-actions btn-group btn-group-xs -view edit search\' role=\'group\'></div>');
      const btnDrag = $('<button class=\'btn btn-default button-drag\' tabindex=\'-1\'><span class=\'glyphicon glyphicon-move\'></span></button>');
      const btnRemove = $('<button class=\'btn btn-default button-delete\' tabindex=\'-1\'><span class=\'glyphicon glyphicon-remove\'></span></button>');
      btnGroup.append(btnDrag, btnRemove);
      template.on('view edit search', function (e) {
        if (e.type === 'view') btnGroup.hide();
        else btnGroup.show();
        e.stopPropagation();
      });
      if (mode === 'view') {
        btnGroup.hide();
      }

      btnRemove.click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        valTemplate.remove();
        about.removeValue( rel_uri, value );
        if ( value.is('v-s:Embedded') && value.hasValue('v-s:parent', about) ) {
          value.delete();
        }
      }).mouseenter(function () {
        valTemplate.addClass('red-outline');
      }).mouseleave(function () {
        valTemplate.removeClass('red-outline');
      });

      // Sortable scroll bugfix
      btnDrag.mouseenter(function () {
        valTemplate.addClass('gray-outline');
      }).mouseleave(function () {
        valTemplate.removeClass('gray-outline');
      }).mousedown(function () {
        relContainer.addClass('sortable-overflow');
      }).mouseup(function () {
        relContainer.removeClass('sortable-overflow');
      });

      if (valTemplate.css('display') !== 'inline') {
        btnGroup.addClass('block');
      }
      if (valTemplate.css('display') === 'table-row' || valTemplate.prop('tagName') === 'TR') {
        const cell = valTemplate.children().last();
        cell.css('position', 'relative').append(btnGroup);
      } else {
        valTemplate.css('position', 'relative');
        valTemplate.append(btnGroup);
      }
    }
    return valTemplate;
  });
}

/**
 * Validate individual property values against property specification
 * @param {IndividualModel} individual - individual to validate
 * @param {string} property_uri - property which values are validated
 * @param {IndividualModel} spec - Property specification to validate values against
 * @return {Object} - validation result
 */
function validate (individual, property_uri, spec) {
  let result = {
    state: true,
    cause: [],
  };
  if (!spec) {
    return result;
  }
  const values = individual.get(property_uri);
  // cardinality check
  if (spec.hasValue('v-ui:minCardinality')) {
    const minCardinalityState = (values.length >= spec['v-ui:minCardinality'][0] &&
    // filter empty values
    values.length === values.filter(function (item) {
      return (
        typeof item === 'boolean' ? true :
          typeof item === 'number' ? true : !!item
      );
    }).length);
    result.state = result.state && minCardinalityState;
    if (!minCardinalityState) {
      result.cause.push('v-ui:minCardinality');
    }
  }
  if (spec.hasValue('v-ui:maxCardinality')) {
    const maxCardinalityState = (
      values.length <= spec['v-ui:maxCardinality'][0] &&
      // filter empty values
      values.length === values.filter(function (item) {
        return (
          typeof item === 'boolean' ? true :
            typeof item === 'number' ? true : !!item
        );
      }).length
    );
    result.state = result.state && maxCardinalityState;
    if (!maxCardinalityState) {
      result.cause.push('v-ui:maxCardinality');
    }
  }
  // check each value
  result = result && values.reduce(function (result, value) {
    // regexp check
    if (spec.hasValue('v-ui:regexp')) {
      const regexp = new RegExp(spec['v-ui:regexp'][0]);
      const regexpState = regexp.test(value.toString());
      result.state = result.state && regexpState;
      if (!regexpState) {
        result.cause.push('v-ui:regexp');
      }
    }
    // range check
    switch (spec['rdf:type'][0].id) {
    case 'v-ui:DatatypePropertySpecification':
      if (spec.hasValue('v-ui:minValue')) {
        const minValueState = (value >= spec['v-ui:minValue'][0]);
        result.state = result.state && minValueState;
        if (!minValueState) {
          result.cause.push('v-ui:minValue');
        }
      }
      if (spec.hasValue('v-ui:maxValue')) {
        const maxValueState = (value <= spec['v-ui:maxValue'][0]);
        result.state = result.state && maxValueState;
        if (!maxValueState) {
          result.cause.push('v-ui:maxValue');
        }
      }
      if (spec.hasValue('v-ui:minLength')) {
        const minLengthState = (value.toString().length >= spec['v-ui:minLength'][0]);
        result.state = result.state && minLengthState;
        if (!minLengthState) {
          result.cause.push('v-ui:minLength');
        }
      }
      if (spec.hasValue('v-ui:maxLength')) {
        const maxLengthState = (value.toString().length <= spec['v-ui:maxLength'][0]);
        result.state = result.state && maxLengthState;
        if (!maxLengthState) {
          result.cause.push('v-ui:maxLength');
        }
      }
      break;
    case 'v-ui:ObjectPropertySpecification':
      break;
    }
    return result;
  }, result);
  return result;
}
