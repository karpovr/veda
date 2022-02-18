// Application presenter

import '../browser/check_browser.js';

import '../browser/notification_listener.js';

import '../browser/line_status_listener.js';

import '../browser/show_ttl.js';

import veda from '../common/veda.js';

import riot from '../common/lib/riot.js';

import IndividualModel from '../common/individual_model.js';

import Notify from './notify.js';

import Util from '../common/util.js';

import {delegateHandler, clear} from '../browser/dom_helpers.js';

/**
 * Application presenter
 * @param {Object} manifest
 */
export default function AppPresenter (manifest) {
  /**
   * Localize resources on the page on language change
   */
  veda.on('language:changed', () => {
    const resourcesNodes = document.querySelectorAll('[resource], [about]');
    let resources = Array.prototype.map.call(resourcesNodes, (node) => node.getAttribute('about') || node.getAttribute('resource'));
    resources = Util.unique(resources);
    resources.forEach((resource_uri) => {
      const resource = new IndividualModel(resource_uri);
      for (const property_uri in resource.properties) {
        if (property_uri === '@') {
          continue;
        }
        if (resource.properties[property_uri] && resource.properties[property_uri].length && resource.properties[property_uri][0].type === 'String') {
          resource.trigger('propertyModified', property_uri, resource.get(property_uri));
          resource.trigger(property_uri, resource.get(property_uri));
        }
      }
    });
  });

  /**
   * Call router when anchor link is clicked
   * @param {Event} event
   * @this {Element}
   * @return {void}
   */
  function anchorHandler (event) {
    event.preventDefault();
    const hash = this.getAttribute('href');
    return (hash === window.location.hash ? false : riot.route(hash));
  }
  delegateHandler(document.body, 'click', '[href^=\'#/\']', anchorHandler);

  // Prevent empty links routing
  delegateHandler(document.body, 'click', '[href=\'\']', (event) => event.preventDefault());

  // Router already installed flag
  let routerInstalled;

  /**
   * Install router
   * @param {Individual} main - Default individual to route if no hash is present
   * @return {void}
   */
  function installRouter (main) {
    if (routerInstalled) {
      return;
    }

    routerInstalled = true;

    // Router function
    riot.route((hash) => {
      const loadIndicator = document.getElementById('load-indicator');
      const loadIndicatorTimer = setTimeout(() => loadIndicator.style.display = '', 250);

      if (typeof hash === 'string') {
        const hash_index = hash.indexOf('#');
        if (hash_index >= 0) {
          hash = hash.substring(hash_index);
        } else {
          const mainContainer = document.getElementById('main');
          clear(mainContainer);
          return main.present(mainContainer).then(() => {
            clearTimeout(loadIndicatorTimer);
            loadIndicator.style.display = 'none';
          });
        }
      } else {
        const mainContainer = document.getElementById('main');
        clear(mainContainer);
        return main.present(mainContainer).then(() => {
          clearTimeout(loadIndicatorTimer);
          loadIndicator.style.display = 'none';
        });
      }
      const tokens = decodeURI(hash).slice(2).split('/');
      const uri = tokens[0];
      const container = tokens[1] || '#main';
      const template = tokens[2];
      const mode = tokens[3];
      let extra = tokens[4];
      if (extra) {
        extra = extra.split('&').reduce((acc, pair) => {
          const split = pair.split('=');
          const name = split[0] || '';
          const values = split[1].split('|') || '';
          acc[name] = acc[name] || [];
          values.forEach((value) => acc[name].push(parse(value)));
          return acc;
        }, {});
      }

      if (uri) {
        const individual = new IndividualModel(uri);
        const containerEl = document.querySelector(container);
        clear(containerEl);
        individual.present(containerEl, template, mode, extra).then(() => {
          clearTimeout(loadIndicatorTimer);
          loadIndicator.style.display = 'none';
          if (!individual.scroll) {
            window.scrollTo(0, 0);
          }
        });
      } else {
        const mainContainer = document.getElementById('main');
        clear(mainContainer);
        main.present(mainContainer).then(() => {
          clearTimeout(loadIndicatorTimer);
          loadIndicator.style.display = 'none';
        });
      }
    });
  }

  /**
   * Parse extra params in hash
   * @param {string} value
   * @return {Individual|Date|string|number|null}
   */
  function parse (value) {
    if (!Number.isNaN(value.split(' ').join('').split(',').join('.'))) {
      return parseFloat(value.split(' ').join('').split(',').join('.'));
    }
    if (!Number.isNaN(Date.parse(value))) {
      return new Date(value);
    }
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    const individual = new IndividualModel(value);
    if (individual.isSync() && !individual.isNew()) {
      return individual;
    }

    return value || null;
  }


  let starting = false;

  // Triggered in auth
  veda.on('started', () => {
    if (starting === true) return;
    starting = true;

    const loadIndicator = document.getElementById('load-indicator');
    loadIndicator.style.display = '';

    const layout_uri = manifest.veda_layout;
    const main_uri = manifest.veda_main;
    const {start_url} = manifest;
    const appContainer = document.getElementById('app');
    clear(appContainer);
    if (layout_uri && main_uri && start_url) {
      const layout = new IndividualModel(layout_uri);
      layout.present(appContainer)
        .then(() => new IndividualModel(main_uri).load())
        .then(installRouter)
        .catch((error) => {
          const notify = new Notify();
          notify('danger', error);
        })
        .then(() => riot.route(window.location.hash || start_url))
        .then(() => starting = false);
    } else {
      console.log('Incomplete layout params in manifest');
      const layout_param_uri = veda.user.hasValue('v-s:origin', 'ExternalUser') ? 'cfg:LayoutExternal' : 'cfg:Layout';
      const layout_param = new IndividualModel(layout_param_uri);
      const main_param_uri = veda.user.hasValue('v-s:origin', 'ExternalUser') ? 'cfg:MainExternal' : 'cfg:Main';
      const main_param = new IndividualModel(main_param_uri);
      layout_param.load()
        .then(() => layout_param['rdf:value'][0].load())
        .then((layout) => layout.present(appContainer))
        .then(() => main_param.load())
        .then(() => main_param['rdf:value'][0].load())
        .then(installRouter)
        .catch((error) => {
          const notify = new Notify();
          notify('danger', error);
        })
        .then(() => riot.route(window.location.hash))
        .then(() => starting = false);
    }
  });
}
