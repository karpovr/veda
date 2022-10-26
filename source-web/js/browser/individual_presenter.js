// Individual presenter

import veda from '../common/veda.js';
import IndividualModel from '../common/individual_model.js';
import Backend from '../common/backend.js';
import BackendError from '../browser/backend_error.js';
import CommonUtil from '../common/util.js';
import BrowserUtil from '../browser/util.js';
import notify from '../browser/notify.js';
import validate from '../browser/validate.js';
import {clear, sanitize} from '../browser/dom_helpers.js';
import $ from 'jquery';
import '../browser/controls/veda_controls.js';

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
    container = document.querySelector(container);
  } else if (container instanceof jQuery) {
    container = container.get(0);
  }

  return this.load()
    .then(() => {
      if (template) {
        return getTemplate(template);
      } else {
        const isClass = this.hasValue('rdf:type', 'owl:Class') || this.hasValue('rdf:type', 'rdfs:Class');
        if (this.hasValue('v-ui:hasTemplate') && !isClass) {
          const templateIndividual = this['v-ui:hasTemplate'][0];
          if (!(templateIndividual instanceof IndividualModel)) {
            throw new TypeError('Custom template must be an individual!');
          }
          return getTemplate(templateIndividual);
        } else {
          const ontology = veda.ontology;
          const templates = this['rdf:type'].map((type) => ontology.getClassTemplate(type.id)).map(getTemplate);
          return Promise.all(templates);
        }
      }
    })
    .then((namedTemplate) => {
      if (Array.isArray(namedTemplate)) {
        return Promise.all(namedTemplate.map(({templateString, name}) => renderTemplate(this, container, templateString, name, mode, extra, toAppend)));
      }
      return renderTemplate(this, container, namedTemplate.templateString, namedTemplate.name, mode, extra, toAppend);
    })
    .catch(errorHandler)
    .catch((error) => errorPrinter.call(this, error, container));
}

/**
 * Get template string
 * @param {IndividualModel|string|HTMLElement} template
 * @return {Promise<{name, template}>}
 */
function getTemplate (template) {
  const reg_uri = /^[a-z][a-z-0-9]*:([a-zA-Z0-9-_])*$/;
  if (template instanceof IndividualModel) {
    return template.load().then((templateIndividual) => {
      if (!templateIndividual.hasValue('rdf:type', 'v-ui:ClassTemplate')) {
        throw new TypeError('v-ui:ClassTemplate required!');
      }
      const templateName = template.id;
      const templateString = template['v-ui:template'][0];
      return {
        name: templateName,
        templateString,
      };
    });
  } else if (typeof template === 'string' && reg_uri.test(template)) {
    const templateIndividual = new IndividualModel(template);
    return getTemplate(templateIndividual);
  } else if (typeof template === 'string') {
    return {
      name: String(template.length),
      templateString: template,
    };
  } else if (template instanceof HTMLElement) {
    return {
      name: String(template.length),
      templateString: template.outerHTML,
    };
  }
  const generic = new IndividualModel('v-ui:generic');
  return getTemplate(generic);
}

/**
 * Show success message
 * @param {Promise} result
 * @return {void}
 */
function successHandler (result) {
  const successMsg = new IndividualModel('v-s:SuccessBundle');
  successMsg.load().then(() => {
    notify('success', {name: successMsg.toString()});
  }).catch((error) => console.error('Msg load failed'));
  return result;
}

/**
 * Show error message
 * @param {Error} error to handle
 * @throw {Error}
 */
function errorHandler (error) {
  if (error instanceof BackendError) {
    const errorIndividual = new IndividualModel(`v-s:Error_${error.code}`);
    errorIndividual.load().then(() => {
      const severity = String(errorIndividual['v-s:tag'][0]) || 'danger';
      notify(severity, {code: errorIndividual['v-s:errorCode'][0], message: errorIndividual['v-s:errorMessage'].map(CommonUtil.formatValue).join(' ')});
    }).catch(() => {
      notify('danger', error);
    });
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
 * @return {HTMLElement}
 */
function errorPrinter (error, container) {
  console.error(`Presenter failed: ${this.id}`);
  let errorIndividual;
  if (error instanceof BackendError) {
    errorIndividual = new IndividualModel(`v-s:Error_${error.code}`);
  } else {
    errorIndividual = new IndividualModel();
    errorIndividual['v-s:tag'] = 'danger';
    errorIndividual['v-s:errorMessage'] = error.toString();
  }
  return errorIndividual.load()
    .then(() => `
      <span class="padding-sm bg-${sanitize(errorIndividual['v-s:tag'][0])} text-${sanitize(errorIndividual['v-s:tag'][0])}" title="${sanitize(this.id)}">
        <strong>${sanitize(errorIndividual['v-s:errorCode'][0] || '')}</strong> ${sanitize(errorIndividual['v-s:errorMessage'].map(CommonUtil.formatValue).join(' '))}
      </span>`)
    .catch(() => `
      <span class="padding-sm bg-danger text-danger" title="${sanitize(this.id)}">
        <strong>${sanitize(error.code)}</strong> ${sanitize(error.name)} ${sanitize(error.message)}>
      </span>`)
    .then((msg) => {
      let wrapper;
      if (container.tagName === 'TBODY' || container.tagName === 'TABLE') {
        const tr = document.createElement('tr');
        const td = tr.appendChild(document.createElement('td'));
        td.colSpan = 999;
        td.innerHTML = msg;
        wrapper = tr;
      } else {
        const div = document.createElement('div');
        div.innerHTML = msg;
        wrapper = div;
      }
      return container.appendChild(wrapper);
    });
}

/**
 * Wrap template
 * @param {String} html
 * @return {HTMLElement}
 */
function wrap (html) {
  html = html.trim();
  if (html.startsWith('<script') || html.endsWith('script>')) {
    console.error('Scripts for inline templates are not supported');
    throw new SyntaxError('Scripts for inline templates are not supported');
  }
  let tagName;
  if (html.startsWith('<tr')) {
    tagName = 'tbody';
  } else if (html.startsWith('<td')) {
    tagName = 'tr';
  } else {
    tagName = 'div';
  }
  const wrapper = document.createElement(tagName);
  wrapper.innerHTML = html;
  const template = wrapper.firstElementChild;
  const last = wrapper.lastElementChild;
  if (last !== template) {
    console.error('Unwrapped templates are not supported');
    throw new SyntaxError('Unwrapped templates are not supported');
  }
  return wrapper;
}

/**
 * Render template
 * @param {IndividualModel} individual - individual to render
 * @param {Element} container - container to render individual to
 * @param {IndividualModel|string} templateString - template string to render individual with
 * @param {string} name - name of template for sourceURL
 * @param {string} mode - view | edit | search
 * @param {Object} extra - extra parameters to pass ro template
 * @param {Boolean} toAppend - flag defining either to append or replace the container's content with rendered template
 * @return {Promise}
 */
function renderTemplate (individual, container, templateString, name, mode, extra, toAppend) {
  const reg_file = /\.js$/;
  if (reg_file.test(templateString)) {
    return import(`/templates/${templateString}`)
      .then((templateModule) => {
        const pre = templateModule.pre;
        const post = templateModule.post;
        const html = templateModule.html;
        if (!html) {
          const pre_result = pre ? pre.call(individual, individual, undefined, container, mode, extra) : undefined;
          return Promise.resolve(pre_result).then(() => {
            const post_result = post ? post.call(individual, individual, undefined, container, mode, extra) : undefined;
            return Promise.resolve(post_result).then(() => undefined);
          });
        } else {
          const wrapper = wrap(templateModule.html);
          const template = wrapper.firstElementChild;
          const pre_result = pre ? pre.call(individual, individual, template, container, mode, extra) : undefined;
          return Promise.resolve(pre_result)
            .then(() => processTemplate(individual, container, wrapper, mode))
            .then((processed) => {
              if (toAppend) {
                container.appendChild(processed);
              }
              processed.dispatchEvent(new Event(mode));
              const post_result = post ? post.call(individual, individual, processed, container, mode, extra) : undefined;
              return Promise.resolve(post_result).then(() => processed);
            });
        }
      });
  } else {
    const wrapper = wrap(templateString);
    return processTemplate(individual, container, wrapper, mode).then((template) => {
      if (toAppend) {
        container.appendChild(template);
      }
      template.dispatchEvent(new Event(mode));
      return template;
    });
  }
}

/**
 * Process template
 * @param {IndividualModel} individual - individual to render
 * @param {Element} container - container to render individual to
 * @param {Element} wrapper - template wrapper
 * @param {string} templateMode - view | edit | search
 * @this Individual
 * @return {Promise}
 */
function processTemplate (individual, container, wrapper, templateMode) {
  let mode = templateMode;

  const template = wrapper.firstElementChild;

  // Get properties specifications
  const specs = individual['rdf:type'].reduce((acc, type) => ({
    ...acc,
    ...veda.ontology.getClassSpecifications(type.id),
  }), {});

  template.setAttribute('resource', individual.id);
  template.setAttribute('typeof', individual['rdf:type'].map((item) => item.id).join(' '));
  template.classList.add('template');

  const view = wrapper.querySelectorAll('.view');
  const edit = wrapper.querySelectorAll('.edit');
  const search = wrapper.querySelectorAll('.search');
  const _view = wrapper.querySelectorAll('.-view');
  const _edit = wrapper.querySelectorAll('.-edit');
  const _search = wrapper.querySelectorAll('.-search');

  // Embedded templates list
  const embedded = [];

  /**
   * Template mode handler. Applies mode to template to show/hide elements in different modes
   * @param {Event} event
   * @return {void}
   */
  const modeHandler = function (event) {
    mode = event.type;
    event.stopPropagation();
    template.setAttribute('data-mode', mode);
    switch (mode) {
    case 'view':
      individual.watch();
      view.forEach((node) => node.style.display = '');
      _view.forEach((node) => node.style.display = 'none');
      break;
    case 'edit':
      individual.unwatch();
      edit.forEach((node) => node.style.display = '');
      _edit.forEach((node) => node.style.display = 'none');
      break;
    case 'search':
      search.forEach((node) => node.style.display = '');
      _search.forEach((node) => node.style.display = 'none');
      break;
    }
    // sync mode for embedded templates
    embedded.forEach((item) => {
      item.dispatchEvent(new Event(mode));
    });
  };
  template.addEventListener('view', modeHandler);
  template.addEventListener('edit', modeHandler);
  template.addEventListener('search', modeHandler);

  // Define handlers
  template.veda = {
    'reset': resetHandler,
    'save': saveHandler,
    'delete': deleteHandler,
    'recover': recoverHandler,
    'remove': removeHandler,
  };

  /**
   * Call method
   * @param {Event} event
   */
  function callMethod (event) {
    event.stopPropagation();
    const type = event.type;
    if (type === 'cancel') {
      resetHandler();
    } else if (type === 'save') {
      saveHandler();
    } else if (type === 'delete') {
      deleteHandler();
    } else if (type === 'recover') {
      recoverHandler();
    } else if (type === 'destroy') {
      removeHandler();
    }
  }

  /**
   * Remove veda methods from node
   * @param {Event} event
   */
  function removeMethods (event) {
    delete event.target.veda;
  }
  template.addEventListener('cancel', callMethod);
  template.addEventListener('save', callMethod);
  template.addEventListener('delete', callMethod);
  template.addEventListener('recover', callMethod);
  template.addEventListener('destroy', callMethod);
  template.addEventListener('remove', removeMethods);

  const switchToView = () => template.dispatchEvent(new Event('view'));

  /**
   * Reset individual and embedded individuals
   * @param {string} parent id
   * @param {Array} acc for individuals uris
   * @return {Promise<void>}
   */
  function resetHandler (parent, acc) {
    return individual.resetAll()
      .then(switchToView)
      .catch(errorHandler);
  }

  /**
   * Save individual and embedded children individuals
   * @param {string} parent id
   * @param {Array} acc for individuals uris
   * @return {Promise<void>}
   */
  function saveHandler () {
    return individual.saveAll()
      .then(switchToView)
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
      .then(switchToView)
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
      .then(switchToView)
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
    acc = embedded.reduce((acc1, item) => {
      return typeof item.veda.remove === 'function' ? item.veda.remove(individual.id, acc1) : acc1;
    }, acc);
    acc.push(individual.id);
    if (parent) {
      return acc;
    }
    const uris = CommonUtil.unique(acc);
    return uris.reduce((p, item) => p.then(() => new IndividualModel(item).remove()), Promise.resolve())
      .then(() => {
        const removedAlert = new IndividualModel('v-s:RemovedAlert');
        removedAlert.load().then(() => {
          clear(template);
          template.innerHTML = `<code>${sanitize(removedAlert.toString())}</code>`;
        }).catch((error) => console.error('Alert load failed'));
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
      if (mode === 'view' && container && container.id !== 'main' && !container.classList.contains('modal-body')) {
        template.classList.add('deleted');
      }
      if (container && (container.id === 'main' || container.classList.contains('modal-body'))) {
        const msg = new IndividualModel('v-s:DeletedAlert');
        msg.load().then(() => {
          const msgStr = msg['rdfs:label'].map(CommonUtil.formatValue).join(' ');
          notify('warning', {name: msgStr});
          const deletedHeader = document.createElement('h4');
          deletedHeader.classList.add('deleted-header');
          deletedHeader.textContent = msgStr;
          deletedHeader.style.textAlign = 'center';
          template.prepend(deletedHeader);
        }).catch((error) => console.error('Msg load failed'));
      }
    } else {
      if (container && container.id === 'main') {
        const header = template.querySelector('.deleted-header');
        if (header) header.remove();
      }
      template.classList.remove('deleted');
    }
  };
  individual.on('v-s:deleted', deletedHandler);
  template.addEventListener('remove', () => individual.off('v-s:deleted', deletedHandler));
  deletedHandler.call(individual);

  /**
   * Individual v-s:valid handler. Shows alert when individual is invalid .
   * @this Individual
   * @return {void}
   */
  const validHandler = function () {
    if ( this.hasValue('v-s:valid', false) ) {
      const isAlertVisible = (
        container && container.id === 'main' ||
        container.classList.contains('modal-body') ||
        template.classList.contains('container') ||
        template.children.length && template.children[0].classList.contains('container')
      );
      if (mode === 'view' && !isAlertVisible) {
        template.classList.add('invalid');
        const msg = new IndividualModel('v-s:InvalidAlert');
        msg.load().then(() => {
          template.title = msg['rdfs:label'].map(CommonUtil.formatValue).join(' ');
        });
      }
      if (isAlertVisible) {
        const msg = new IndividualModel('v-s:InvalidAlert');
        msg.load().then(() => {
          const msgStr = msg['rdfs:label'].map(CommonUtil.formatValue).join(' ');
          notify('warning', {name: msgStr});
          const invalidHeader = document.createElement('h4');
          invalidHeader.classList.add('invalid-header');
          invalidHeader.textContent = msgStr;
          invalidHeader.style.textAlign = 'center';
          template.prepend(invalidHeader);
        }).catch((error) => console.error('Msg load failed'));
      }
    } else {
      if (container && container.id === 'main') {
        const header = template.querySelector('.invalid-header');
        if (header) header.remove();
      }
      template.classList.remove('invalid');
    }
  };
  individual.on('v-s:valid', validHandler);
  template.addEventListener('remove', () => individual.off('v-s:valid', validHandler));
  validHandler.call(individual);

  // Process RDFa compliant template

  // Special (not RDFa)
  wrapper.querySelectorAll('[href*=\'@\']:not([rel] *):not([about] *)').forEach((node) => {
    const href = node.getAttribute('href');
    node.setAttribute('href', href.replace('@', individual.id));
  });

  wrapper.querySelectorAll('[src*=\'@\']:not([rel] *):not([about] *)').forEach((node) => {
    const src = node.getAttribute('src');
    node.setAttribute('src', src.replace('@', individual.id));
  });

  wrapper.querySelectorAll('[style*=\'@\']:not([rel] *):not([about] *)').forEach((node) => {
    const style = node.getAttribute('style');
    node.setAttribute('style', style.replace('@', individual.id));
  });

  wrapper.querySelectorAll('[title]:not([rel] *):not([about] *)').forEach((node) => {
    const title = node.getAttribute('title');
    if ((/^[a-z][a-z-0-9]*:([a-zA-Z0-9-_])*$/).test(title) ) {
      const titleIndividual = new IndividualModel(title);
      titleIndividual.load().then(() => {
        node.setAttribute('title', titleIndividual.toString());
      });
    }
  });

  // Property values
  const props = Array.from(wrapper.querySelectorAll('[property]:not(veda-control):not([rel] *):not([about] *)')).map((propertyContainer) => {
    const property_uri = propertyContainer.getAttribute('property');
    const about_uri = propertyContainer.getAttribute('about');
    let about;
    let isAbout;

    if (about_uri === '@') {
      about = individual;
      isAbout = true;
      propertyContainer.setAttribute('about', about.id);
    } else if (!about_uri) {
      about = individual;
      isAbout = false;
    } else {
      about = new IndividualModel(about_uri);
      isAbout = true;
    }

    return about.load()
      .then(() => {
        const idModifiedHandler = function () {
          propertyContainer.textContent = about.id;
        };
        if (property_uri === '@') {
          propertyContainer.textContent = about.id;
          about.on('idChanged', idModifiedHandler);
          template.addEventListener('remove', () => about.off('idChanged', idModifiedHandler));
          return;
        }

        // Re-render all property values if model's property was changed
        const propertyModifiedHandler = function () {
          renderPropertyValues(about, isAbout, property_uri, propertyContainer, template, mode);
        };
        about.on(property_uri, propertyModifiedHandler);
        template.addEventListener('remove', () => about.off(property_uri, propertyModifiedHandler));

        renderPropertyValues(about, isAbout, property_uri, propertyContainer, template, mode);
      })
      .catch((error) => errorPrinter.call(about, error, propertyContainer));
  });

  // Related resources & about resources
  const rels = Array.from(wrapper.querySelectorAll('[rel]:not(veda-control):not([rel] *):not([about] *)')).map((relContainer) => {
    let about = relContainer.getAttribute('about');
    const rel_uri = relContainer.getAttribute('rel');
    const isEmbedded = relContainer.getAttribute('data-embedded') === 'true';
    const spec = specs[rel_uri] ? new IndividualModel( specs[rel_uri] ) : undefined;
    const rel_inline_template = relContainer.innerHTML.trim();
    const rel_template_uri = relContainer.getAttribute('data-template');
    let limit = relContainer.getAttribute('data-limit') == null ? Infinity : parseInt(relContainer.getAttribute('data-limit'));
    const more = relContainer.getAttribute('data-more') || false;
    let relTemplate;
    let isAbout;

    if (about) {
      isAbout = true;
      about = (about === '@' ? individual : new IndividualModel(about));
      relContainer.setAttribute('about', about.id);
    } else {
      isAbout = false;
      about = individual;
    }

    if ( rel_template_uri ) {
      relTemplate = rel_template_uri;
    } else if ( rel_inline_template.length ) {
      relTemplate = rel_inline_template;
    }
    relContainer.innerHTML = '';

    template.addEventListener('edit', function (e) {
      const property = new IndividualModel(rel_uri);
      if ( isEmbedded &&
          spec &&
          spec['v-ui:minCardinality'][0] >= 1 &&
          !individual.hasValue(rel_uri) &&
          !(property.hasValue('rdfs:range') && property['rdfs:range'][0].id === 'v-s:File')
      ) {
        const valueType = spec && spec.hasValue('v-ui:rangeRestriction') && spec['v-ui:rangeRestriction'] ||
          property.hasValue('rdfs:range') && property['rdfs:range'] || [];
        const emptyValue = new IndividualModel();
        if ( valueType.length ) {
          emptyValue['rdf:type'] = valueType;
        }
        individual.set(rel_uri, [emptyValue]);
      }
      e.stopPropagation();
    });

    return about.load().then(() => {
      let prev_rendered = {};
      let curr_rendered = {};
      let sort_required = false;

      const propertyModifiedHandler = function (propertyValues, limit_param) {
        curr_rendered = {};
        limit = limit_param || limit;

        return Promise.all(
          propertyValues.map((value, i) => {
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
            return renderRelationValue({about, isAbout, rel_uri, value, relContainer, relTemplate, template, mode, embedded, isEmbedded, toAppend: false})
              .then((renderedTemplate) => {
                curr_rendered[value.id] = i;
                return renderedTemplate;
              });
          }).filter(Boolean),
        ).then((nodes) => {
          relContainer.append(...nodes.flat());
          const prev_uris = Object.keys(prev_rendered);
          if (prev_uris.length) {
            const selector = prev_uris.map((uri) => `[resource="${BrowserUtil.escape4$(uri)}"]`).join(',');
            relContainer.querySelectorAll(selector).forEach((node) => {
              const index = embedded.indexOf(node);
              if (index >= 0) embedded.splice(index, 1);
              node.remove();
            });
          }
          if (sort_required) {
            const list = Array.from(relContainer.children).map((node) => relContainer.removeChild(node));
            list.sort((a, b) => {
              return curr_rendered[a.getAttribute('resource')] - curr_rendered[b.getAttribute('resource')];
            });
            relContainer.append(...list);
          }
          if (limit < propertyValues.length && more) {
            let moreButton = relContainer.querySelector('a.more');
            if (!moreButton) {
              moreButton = document.createElement('a');
              moreButton.classList.add('more', 'badge');
            }
            moreButton.textContent = `↓ ${propertyValues.length - limit}`;
            moreButton.addEventListener('click', (e) => {
              e.stopPropagation();
              const countDisplayed = relContainer.children.length - 1; // last children is .more button
              about.trigger(rel_uri, about.get(rel_uri), countDisplayed + 10);
              e.target.remove();
            });
            relContainer.append(moreButton);
          }
          prev_rendered = {...curr_rendered};
          template.dispatchEvent(new Event('internal-validate'), {bubbles: true});
        });
      };

      const embeddedHandler = function (propertyValues) {
        if (mode === 'edit') {
          propertyValues.map((value) => {
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
        template.addEventListener('remove', () => about.off(rel_uri, embeddedHandler));
      }

      about.on(rel_uri, propertyModifiedHandler);
      template.addEventListener('remove', () => about.off(rel_uri, propertyModifiedHandler));

      return propertyModifiedHandler(values, limit);
    });
  });

  // About resource
  const abouts = Array.from(wrapper.querySelectorAll('[about]:not([rel] *):not([about] *):not([rel]):not([property])')).map((aboutContainer) => {
    const about_template_uri = aboutContainer.getAttribute('data-template');
    const about_inline_template = aboutContainer.innerHTML.trim();
    const isEmbedded = aboutContainer.getAttribute('data-embedded') === 'true';
    let about;
    let aboutTemplate;
    if ( about_template_uri ) {
      aboutTemplate = about_template_uri;
    } else if ( about_inline_template.length ) {
      aboutTemplate = about_inline_template;
    }
    aboutContainer.innerHTML = '';
    if (aboutContainer.getAttribute('about') === '@') {
      about = individual;
      aboutContainer.setAttribute('about', about.id);
    } else {
      about = new IndividualModel(aboutContainer.getAttribute('about'));
    }
    return about.present(aboutContainer, aboutTemplate, isEmbedded ? mode : undefined).then((rendered) => {
      if (!Array.isArray(rendered)) {
        rendered = [rendered];
      }
      if (isEmbedded) {
        embedded.push(...rendered);
        rendered.forEach((node) => {
          node.setAttribute('data-embedded', 'true');
          if (mode === 'edit') {
            node.dispatchEvent(new Event('internal-validate'));
          }
        });
      }
    });
  });

  // Validation with support of embedded templates (arbitrary depth)

  // Initial validation state
  const validation = {state: true};
  template.setAttribute('data-valid', validation.state);

  /**
  * Validate template handler
  * @param {Event} event - custom 'internal-validate' event
  * @return {void}
  */
  const validateTemplate = function (event) {
    if (event instanceof Event) {
      event.stopPropagation();
    }
    if (mode !== 'edit') return;

    Object.keys(validation).forEach((property_uri) => {
      if (property_uri === 'state') {
        return;
      }
      const spec = specs[property_uri] ? new IndividualModel( specs[property_uri] ) : undefined;
      validation[property_uri] = validate(individual, property_uri, spec);
    });
    template.dispatchEvent(new Event('validate'));
    validation.state = Object.keys(validation).reduce((acc, property_uri) => {
      if (property_uri === 'state') {
        return acc;
      }
      return acc && validation[property_uri].state;
    }, true);
    validation.embeddedState = embedded.reduce((acc, embeddedTemplate) => {
      const embeddedValidation = embeddedTemplate.getAttribute('data-valid') === 'true';
      return acc && embeddedValidation;
    }, true);
    validation.state = validation.state && validation.embeddedState;
    template.setAttribute('data-valid', validation.state);
    template.dispatchEvent(new CustomEvent('internal-validated', {detail: validation}));

    // 'internal-validate' event should bubble and trigger parent template validation if current template is embedded
    if ( container.getAttribute('data-embedded') === 'true' ) {
      container.dispatchEvent(new Event('internal-validate', {bubbles: true}));
    }
  };
  individual.on('propertyModified', validateTemplate);
  template.addEventListener('remove', () => individual.off('propertyModified', validateTemplate));
  template.addEventListener('internal-validate', validateTemplate);
  template.addEventListener('edit', validateTemplate);

  /**
  * Merge validation result from custom template validation
  * @param {Event} event - custom 'validated' event
  * @param {Object} validationResult - validation result object
  * @return {void}
  */
  const mergeValidationResult = function (event) {
    const validationResult = event.detail;
    event.stopPropagation();
    if (mode === 'edit') {
      Object.keys(validationResult).forEach((property_uri) => {
        if (property_uri === 'state') {
          return;
        }
        validation[property_uri] = validationResult[property_uri];
      });
      const mergedState = Object.keys(validation).reduce((acc, property_uri) => {
        if (property_uri === 'state') {
          return acc;
        }
        if (property_uri === 'embeddedState') {
          return acc && validation[property_uri];
        }
        return acc && validation[property_uri].state;
      }, true);

      validation.state = mergedState && validation.embeddedState;
      template.setAttribute('data-valid', validation.state);
      template.dispatchEvent(new CustomEvent('internal-validated', {detail: validation}));

      // 'internal-validate' event should bubble and trigger parent template validation if current template is embedded
      if ( container.getAttribute('data-embedded') === 'true' ) {
        container.dispatchEvent(new Event('internal-validate', {bubbles: true}));
      }
    }
    // вроде как больше не нужно
    // // "validate" event should bubble up to be handled by parent template only if current template is embedded
    // if ( template.data('isEmbedded') ) {
    //   container.trigger('validated', {});
    // }
  };

  // Handle validation events from template
  template.addEventListener('validate', (e) => e.stopPropagation());
  template.addEventListener('validated', mergeValidationResult);

  // Controls
  Array.from(wrapper.querySelectorAll('veda-control:not([rel] *):not([about] *)')).forEach((el) => {
    const control = $(el);
    const property_uri = control.attr('property') || control.attr('rel');
    const type = control.attr('data-type') || 'generic';
    const spec = specs[property_uri] ? new IndividualModel( specs[property_uri] ) : undefined;
    const controlType = $.fn['veda_' + type];

    // Initial validation state
    validation[property_uri] = {state: true, cause: []};

    const validatedHandler = function (e) {
      const validationResult = e.detail;
      if ( validationResult.state || !validationResult[property_uri] || validationResult[property_uri].state === true ) {
        control.removeClass('has-error');
        control.popover('destroy');
      } else {
        control.addClass('has-error');
        let explanation;
        if (validationResult[property_uri].message) {
          explanation = validationResult[property_uri].message;
        } else {
          const causesPromises = validationResult[property_uri].cause.map((cause_uri) => {
            return new IndividualModel(cause_uri).load();
          });
          Promise.all(causesPromises).then((causes) => {
            explanation = causes.map((cause) => {
              return cause['rdfs:comment'].map(CommonUtil.formatValue).filter(Boolean).join(', ');
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
    template.addEventListener('internal-validated', validatedHandler);

    const syncControl = (e) => {
      e.stopPropagation();
      control.triggerHandler(e.type);
    };
    template.addEventListener('view', syncControl);
    template.addEventListener('edit', syncControl);
    template.addEventListener('search', syncControl);

    const assignDefaultValue = function (e) {
      if ( spec && spec.hasValue('v-ui:defaultValue') && !individual.hasValue(property_uri) ) {
        individual.set(property_uri, spec['v-ui:defaultValue']);
      }
      e.stopPropagation();
    };
    template.addEventListener('edit', assignDefaultValue);

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
    wrapper = null;
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
  propertyContainer.innerHTML = '';
  about.get(property_uri).map((value) => {
    const formattedValue = CommonUtil.formatValue(value);
    if (isAbout) {
      const prevValue = propertyContainer.textContent;
      if (prevValue) {
        propertyContainer.textContent += formattedValue ? ' ' + formattedValue : '';
      } else {
        propertyContainer.textContent = formattedValue;
      }
    } else {
      const valueHolder = document.createElement('span');
      valueHolder.classList.add('value-holder');
      valueHolder.textContent = CommonUtil.formatValue(value);
      propertyContainer.append(valueHolder);
      const btnGroup = document.createElement('div');
      btnGroup.classList.add('prop-actions', 'btn-group', 'btn-group-xs');
      const btnRemove = document.createElement('button');
      btnRemove.classList.add('btn', 'btn-default', 'glyphicon', 'glyphicon-remove');
      btnRemove.setAttribute('tabindex', '-1');
      btnGroup.appendChild(btnRemove);
      if (mode === 'view') {
        btnGroup.style.display = 'none';
      }
      const show = (e) => {
        e.stopPropagation();
        btnGroup.style.display = '';
      };
      const hide = (e) => {
        e.stopPropagation();
        btnGroup.style.display = 'none';
      };
      template.addEventListener('view', hide);
      template.addEventListener('edit', show);
      template.addEventListener('search', show);
      btnRemove.addEventListener('click', () => about.removeValue(property_uri, value));
      btnRemove.addEventListener('mouseenter', () => valueHolder.classList.add('red-outline'));
      btnRemove.addEventListener('mouseleave', () => valueHolder.classList.remove('red-outline'));
      valueHolder.appendChild(btnGroup);
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
function renderRelationValue ({about, isAbout, rel_uri, value, relContainer, relTemplate, template, mode, embedded, isEmbedded, toAppend}) {
  return value.present(relContainer, relTemplate, isEmbedded ? mode : undefined, undefined, toAppend).then((rendered) => {
    if (!Array.isArray(rendered)) {
      rendered = [rendered];
    }
    if (isEmbedded) {
      embedded.push(...rendered);
      rendered.forEach((node) => {
        node.setAttribute('data-embedded', 'true');
        if (mode === 'edit') {
          node.dispatchEvent(new Event('internal-validate'));
        }
      });
    }
    if (!isAbout) {
      const btnGroup = document.createElement('div');
      btnGroup.classList.add('rel-actions', 'btn-group', 'btn-group-xs');
      const btnRemove = document.createElement('button');
      btnRemove.classList.add('btn', 'btn-default', 'glyphicon', 'glyphicon-remove');
      btnRemove.setAttribute('tabindex', '-1');
      btnGroup.appendChild(btnRemove);
      if (mode === 'view') {
        btnGroup.style.display = 'none';
      }
      const show = (e) => {
        e.stopPropagation();
        btnGroup.style.display = '';
      };
      const hide = (e) => {
        e.stopPropagation();
        btnGroup.style.display = 'none';
      };
      template.addEventListener('view', hide);
      template.addEventListener('edit', show);
      template.addEventListener('search', show);

      btnRemove.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        about.removeValue(rel_uri, value);
        if ( value.is('v-s:Embedded') && value.hasValue('v-s:parent', about) && !value.isNew() ) {
          value.set('v-s:deleted', true);
        }
      });
      btnRemove.addEventListener('mouseenter', () => rendered.forEach((item) => item.classList.add('red-outline')));
      btnRemove.addEventListener('mouseleave', () => rendered.forEach((item) => item.classList.remove('red-outline')));

      rendered.forEach((item) => {
        if (item.style.display !== 'inline') {
          btnGroup.classList.add('block');
        }
        if (item.style.display === 'table-row' || item.tagName === 'TR') {
          const cell = item.lastElementChild;
          cell.style.position = 'relative';
          cell.appendChild(btnGroup);
        } else {
          item.style.position = 'relative';
          item.appendChild(btnGroup);
        }
      });
    }
    return rendered;
  });
}
