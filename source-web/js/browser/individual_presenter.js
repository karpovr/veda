// Individual presenter

import veda from '../common/veda.js';

import IndividualModel from '../common/individual_model.js';

import Backend from '../common/backend.js';

import Util from '../common/util.js';

import '../browser/util.js';

import riot from '../common/lib/riot.js';

import Notify from '../browser/notify.js';

import '../browser/controls/veda_controls.js';

import $ from 'jquery';

import 'jquery-ui';

import 'tablesortable';

import validate from '../browser/validate.js';

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

  if (typeof container === 'string' || container instanceof HTMLElement) {
    container = $(container);
  }

  return this.load()
    .then(() => {
      if (template) {
        return getTemplateString(template);
      } else {
        const isClass = this.hasValue('rdf:type', 'owl:Class') || this.hasValue('rdf:type', 'rdfs:Class');
        if (this.hasValue('v-ui:hasTemplate') && !isClass) {
          const templateIndividual = this['v-ui:hasTemplate'][0];
          if (!templateIndividual instanceof IndividualModel) {
            throw new TypeError('Custom template must be an individual!');
          }
          return getTemplateString(templateIndividual);
        } else {
          const ontology = veda.ontology;
          const templates = this['rdf:type'].map((type) => ontology.getClassTemplate(type.id)).map(getTemplateString);
          return Promise.all(templates);
        }
      }
    })
    .then((template) => {
      if (Array.isArray(template)) {
        return Promise.all(template.map(({template, name}) => renderTemplate(this, container, template, name, mode, extra, toAppend)));
      }
      return renderTemplate(this, container, template.template, template.name, mode, extra, toAppend);
    })
    .then((rendered) => {
      if (Array.isArray(rendered)) {
        return rendered.reduce((acc, item) => acc.add(item), $());
      }
      return rendered;
    })
    .catch(errorHandler)
    .catch((error) => errorPrinter.call(this, error, container));
}

/**
 * Get template string
 * @param {IndividualModel|string|HTMLElement} template
 * @return {Promise<{name, template}>}
 */
function getTemplateString (template) {
  const reg_uri = /^[a-z][a-z-0-9]*:([a-zA-Z0-9-_])*$/;
  const reg_file = /\.html$/;
  if (template instanceof IndividualModel) {
    return template.load().then((templateIndividual) => {
      if (!templateIndividual.hasValue('rdf:type', 'v-ui:ClassTemplate')) {
        throw new TypeError('v-ui:ClassTemplate required!');
      }
      const templateName = template.id;
      const templateString = template['v-ui:template'][0];
      if (reg_file.test(templateString)) {
        return veda.Backend.loadFile('/templates/' + templateString).then((data) => ({
          name: templateName,
          template: data.trim(),
        }));
      }
      return {
        name: templateName,
        template: templateString.trim(),
      };
    });
  } else if (typeof template === 'string' && reg_uri.test(template)) {
    const templateIndividual = new IndividualModel(template);
    return getTemplateString(templateIndividual);
  } else if (typeof template === 'string') {
    return {
      name: String(template.length),
      template: template.trim(),
    };
  } else if (template instanceof HTMLElement) {
    return {
      name: String(template.length),
      template: template.outerHTML.trim(),
    };
  }
  const generic = new IndividualModel('v-ui:generic');
  return getTemplateString(generic);
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
  const notify = new Notify();
  if (typeof error.code !== 'undefined') {
    const errorIndividual = new IndividualModel(`v-s:Error_${error.code}`);
    errorIndividual.load().then((errorIndividual) => {
      const severity = String(errorIndividual['v-s:tag'][0]) || 'danger';
      notify(severity, {name: errorIndividual['v-s:errorCode'][0], message: errorIndividual['v-s:errorMessage'].map(Util.formatValue).join(' ')});
    }).catch(console.log);
  } else {
    notify('danger', {name: error.toString()});
  }
  throw error;
}

/**
 * Print error message in coontainer
 * @param {Error} error to print
 * @param {Object} container for error
 * @this {IndividualModel}
 * @return {jQuery}
 */
function errorPrinter (error, container) {
  console.log(`presenter error: ${this.id}`, error, error.stack);
  const errorIndividual = new IndividualModel(`v-s:Error_${error.code}`);
  return errorIndividual.load()
    .then((errorIndividual) => `
      <span class="padding-sm bg-${errorIndividual['v-s:tag'][0]} text-${errorIndividual['v-s:tag'][0]}" title="${this.id}">
        <strong>${error.code}</strong> ${errorIndividual['v-s:errorMessage'].map(Util.formatValue).join(' ')}
      </span>`)
    .catch(() => `
      <span class="padding-sm bg-danger text-danger" title="${this.id}">
        <strong>${error.code}</strong> ${error.name} ${error.message}>
      </span>`)
    .then((msg) => {
      if (container.prop('tagName') === 'TBODY' || container.prop('tagName') === 'TABLE') {
        msg = $(`<tr><td colspan="999">${msg}</td></tr>`);
      } else {
        msg = $(`<div>${msg}</div>`);
      }
      container.append(msg);
      return msg;
    });
}

/**
 * Render template
 * @param {IndividualModel} individual - individual to render
 * @param {Element} container - container to render individual to
 * @param {IndividualModel|string} template - template string to render individual with
 * @param {string} name - name of template for sourceURL
 * @param {string} mode - view | edit | search
 * @param {Object} extra - extra parameters to pass ro template
 * @param {Boolean} toAppend - flag defining either to append or replace the container's content with rendered template
 * @return {Promise}
 */
function renderTemplate (individual, container, template, name, mode, extra, toAppend) {
  // Extract pre script, template and post script
  const match = template.match(/^(?:<script[^>]*>([\s\S]*?)<\/script>)?([\s\S]*?)(?:<script[^>]*>(?![\s\S]*<script[^>]*>)([\s\S]*)<\/script>)?$/i);
  const pre_render_src = match[1];
  template = $( match[2] );
  const post_render_src = match[3];

  let pre_result;
  if (pre_render_src) {
    pre_result = eval(`(function () { 'use strict';\n${pre_render_src}\n}).call(individual);\n//# sourceURL=${name}_pre`);
  }

  return (pre_result instanceof Promise ? pre_result : Promise.resolve(pre_result)).then(() => {
    return processTemplate(individual, container, template, mode).then((processedTemplate) => {
      processedTemplate.triggerHandler(mode);

      if (toAppend) {
        container.append(processedTemplate);
      }

      let post_result;
      if (post_render_src) {
        post_result = eval(`(function () { 'use strict';\n${post_render_src}\n}).call(individual);\n//# sourceURL=${name}_post`);
      }
      return (post_result instanceof Promise ? post_result : Promise.resolve(post_result))
        .then(() => processedTemplate);
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
      individual['rdf:type'].map((_class) => {
        return ontology.getClassSpecifications(_class.id);
      }),
    ),
  );
  template.attr({
    'resource': individual.id,
    'typeof': individual['rdf:type'].map((item) => {
      return item.id;
    }).join(' '),
  }).addClass('template');

  const view = template.find('.view').addBack('.view');
  const edit = template.find('.edit').addBack('.edit');
  const search = template.find('.search').addBack('.search');
  const _view = template.find('.-view').addBack('.-view');
  const _edit = template.find('.-edit').addBack('.-edit');
  const _search = template.find('.-search').addBack('.-search');

  // Embedded templates list
  const embedded = [];

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
    // sync mode for embedded templates
    embedded.map((item) => {
      item.triggerHandler(event.type, individual.id);
    });
  };
  template.on('view edit search', modeHandler);

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
        removedAlert.load().then((removedAlert) => {
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
        Promise.all([alertModel.load(), recoverModel.load(), this.canUpdate()]).then((arr) => {
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
          $('.recover', deletedAlert).click(() => {
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
        new IndividualModel('v-s:InvalidAlert').load().then((loaded) => {
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
  template.find('[href*=\'@\']:not([rel] *):not([about] *)').addBack('[href*=\'@\']:not([rel] *):not([about] *)').map((i, el) => {
    const self = $(el);
    const str = self.attr('href');
    self.attr('href', str.replace('@', individual.id));
  });

  template.find('[src*=\'@\']:not([rel] *):not([about] *)').addBack('[src*=\'@\']:not([rel] *):not([about] *)').map((i, el) => {
    const self = $(el);
    const str = self.attr('src');
    self.attr('src', str.replace('@', individual.id));
  });

  template.find('[style*=\'@\']:not([rel] *):not([about] *)').addBack('[style*=\'@\']:not([rel] *):not([about] *)').map((i, el) => {
    const self = $(el);
    const style = self.attr('style');
    self.attr('style', style.replace('@', individual.id));
  });

  template.find('[title]:not([rel] *):not([about] *)').addBack('[style*=\'@\']:not([rel] *):not([about] *)').map((i, el) => {
    const self = $(el);
    const title = self.attr('title');
    if ( (/^(\w|-)+:.*?$/).test(title) ) {
      const titleIndividual = new IndividualModel(title);
      titleIndividual.load().then((titleIndividual) => {
        self.attr('title', titleIndividual);
      });
    }
  });

  // Property values
  const props = template.find('[property]:not(veda-control):not([rel] *):not([about] *)').addBack('[property]:not(veda-control):not([rel] *):not([about] *)').map((i, el) => {
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

    return about.load().then((about) => {
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
    })
      .catch((error) => errorPrinter.call(about, error, propertyContainer));
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

    resource.trigger(rel_uri, resource.get(rel_uri), countDisplayed + 10);
    $this.remove();
  });

  // Related resources & about resources
  const rels = template.find('[rel]:not(veda-control):not([rel] *):not([about] *)').addBack('[rel]:not(veda-control):not([rel] *):not([about] *)').map((i, el) => {
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
          uris.map((uri) => {
            return new IndividualModel(uri);
          }),
        );
      },
    };
    relContainer.sortable(sortableOptions);
    template.one('remove', function () {
      if (relContainer.sortable('instance')) {
        relContainer.sortable('destroy');
      }
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

    return about.load().then((about) => {
      let prev_rendered = {};
      let curr_rendered = {};
      let sort_required = false;

      const propertyModifiedHandler = function (values, limit_param) {
        if (!values.length) {
          prev_rendered = {};
          curr_rendered = {};
          sort_required = false;
          relContainer.empty();
          return;
        }

        limit = limit_param || limit;

        return Promise.all(
          values.map((value, i) => {
            if (i >= limit) {
              return;
            }
            if (value.id in prev_rendered) {
              curr_rendered[value.id] = prev_rendered[value.id];
              if (curr_rendered[value.id] !== i) {
                curr_rendered[value.id] = i;
                sort_required = true;
              }
              delete prev_rendered[value.id];
              return;
            }
            return renderRelationValue(about, isAbout, rel_uri, value, relContainer, relTemplate, template, mode, embedded, isEmbedded, false)
              .then((template) => {
                curr_rendered[value.id] = i;
                return template;
              });
          }).filter(Boolean),
        ).then((templates) => {
          relContainer.append(templates);
          const prev_uris = Object.keys(prev_rendered);
          if (prev_uris.length) {
            const selector = prev_uris.map((uri) => `[resource="${Util.escape4$(uri)}"]`).join(',');
            $(selector, relContainer).remove();
          }
          if (sort_required) {
            const list = relContainer.children().detach().toArray();
            list.sort((a, b) => {
              return curr_rendered[a.getAttribute('resource')] - curr_rendered[b.getAttribute('resource')];
            });
            relContainer.append(list);
          }
          if (limit < values.length && more) {
            relContainer.children('a.more').remove();
            relContainer.append( '<a class=\'more badge\'>&darr; ' + (values.length - limit) + '</a>' );
          }
          prev_rendered = {...curr_rendered};
        });
      };

      const embeddedHandler = function (values) {
        if (mode === 'edit') {
          values.map((value) => {
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

      const values = about.get(rel_uri);

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
  const abouts = template.find('[about]:not([rel] *):not([about] *):not([rel]):not([property])').addBack('[about]:not([rel] *):not([about] *):not([rel]):not([property])').map((i, el) => {
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
    return about.present(aboutContainer, aboutTemplate, isEmbedded ? mode : undefined).then((aboutTemplate) => {
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
      Object.keys(validation).map((property_uri) => {
        if (property_uri === 'state') {
          return;
        }
        const spec = specs[property_uri] ? new IndividualModel( specs[property_uri] ) : undefined;
        validation[property_uri] = validate(individual, property_uri, spec);
      });
      template.trigger('validate');
      validation.state = Object.keys(validation).reduce((acc, property_uri) => {
        if (property_uri === 'state') {
          return acc;
        }
        return acc && validation[property_uri].state;
      }, true);
      validation.state = validation.state && embedded.reduce((acc, embeddedTemplate) => {
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
      Object.keys(validationResult).map((property_uri) => {
        if (property_uri === 'state') {
          return;
        }
        validation[property_uri] = validationResult[property_uri];
      });
      validation.state = Object.keys(validation).reduce((acc, property_uri) => {
        if (property_uri === 'state') {
          return acc;
        }
        return acc && validation[property_uri].state;
      }, true);
      validation.state = validation.state && embedded.reduce((acc, embeddedTemplate) => {
        const embeddedValidation = embeddedTemplate.data('validation');
        return embeddedValidation ? acc && embeddedValidation.state : acc;
      }, true);
      template.trigger('internal-validated', [validation]);
    }
  };

  // Handle validation events from template
  template.on('validate', (e) => e.stopPropagation());
  template.on('validated', mergeValidationResult);

  // Controls
  template.find('veda-control[property], veda-control[rel]').not('[rel] *').not('[about] *').map((i, el) => {
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
          const causesPromises = validation[property_uri].cause.map((cause_uri) => {
            return new IndividualModel(cause_uri).load();
          });
          Promise.all(causesPromises).then((causes) => {
            explanation = causes.map((cause) => {
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
  return Promise.all(promises).then(() => {
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
  about.get(property_uri).map((value) => {
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

      btnRemove.click(() => {
        about.removeValue( property_uri, value );
      }).mouseenter(() => {
        valueHolder.addClass('red-outline');
      }).mouseleave(() => {
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
  return value.present(relContainer, relTemplate, isEmbedded ? mode : undefined, undefined, toAppend).then((valTemplate) => {
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

      btnRemove.click((e) => {
        e.preventDefault();
        e.stopPropagation();
        valTemplate.remove();
        about.removeValue( rel_uri, value );
        if ( value.is('v-s:Embedded') && value.hasValue('v-s:parent', about) ) {
          value.delete();
        }
      }).mouseenter(() => {
        valTemplate.addClass('red-outline');
      }).mouseleave(() => {
        valTemplate.removeClass('red-outline');
      });

      // Sortable scroll bugfix
      btnDrag.mouseenter(() => {
        valTemplate.addClass('gray-outline');
      }).mouseleave(() => {
        valTemplate.removeClass('gray-outline');
      }).mousedown(() => {
        relContainer.addClass('sortable-overflow');
      }).mouseup(() => {
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

