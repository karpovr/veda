// Application presenter

import './check_browser.js';

import veda from '../common/veda.js';

import riot from '../common/lib/riot.js';

import IndividualModel from '../common/individual_model.js';

import Notify from './notify.js';

import Util from '../common/util.js';

import {delegateHandler} from '../browser/dom_helpers.js';

import '../browser/notification_listener.js';

import '../browser/line_status_listener.js';

/**
 * Application presenter
 */
export default function AppPresenter () {
  /**
   * Render individual under mouse pointer with special system template v-ui:ttl
   * when Left mouse button with Ctrl + Alt keys are pressed
   * @param {Event} event
   * @this Element
   */
  function specialTemplateHandler (event) {
    const uri = this.getAttribute('resource') || this.getAttribute('about');
    const hash = `#/${uri}`;
    if (event.altKey && event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      riot.route(`${hash}//v-ui:ttl`);
    }
  }
  delegateHandler(document.body, 'click', '[resource], [about]', specialTemplateHandler, true);

  // Outline resource containers to switch view to special templates
  let outlined;

  /**
   * Unset title and remove outline from individual under mouse pointer
   * @param {Event} event
   */
  function removeOutline (event) {
    document.body.removeEventListener('mouseover', outline);
    if (outlined) {
      outlined.removeAttribute('title');
      outlined.classList.remove('gray-outline');
    }
    outlined = null;
  }

  /**
   * Set title = individual id and add outline for individual under mouse pointer
   * when Left mouse button with Ctrl + Alt keys are pressed
   * @param {Event} event
   * @this Element
   */
  function outline (event) {
    if (event.altKey && event.ctrlKey) {
      event.stopPropagation();
      if (outlined) {
        outlined.classList.remove('gray-outline');
        outlined.removeAttribute('title');
      }
      this.classList.add('gray-outline');
      this.setAttribute('title', this.getAttribute('resource') || this.getAttribute('about'));
      outlined = this;
    } else {
      removeOutline(event);
    }
  }

  document.body.addEventListener('keydown', (event) => {
    if (event.altKey && event.ctrlKey) {
      delegateHandler(document.body, 'mouseover', '[resource], [about]', outline);
    }
  });
  document.body.addEventListener('keyup', removeOutline);

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
      loadIndicator.style.display = '';

      if (typeof hash === 'string') {
        const hash_index = hash.indexOf('#');
        if (hash_index >= 0) {
          hash = hash.substring(hash_index);
        } else {
          $('#main').empty();
          return main.present('#main').then(() => loadIndicator.style.display = 'none');
        }
      } else {
        $('#main').empty();
        return main.present('#main').then(() => loadIndicator.style.display = 'none');
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
        $(container).empty();
        individual.present(container, template, mode, extra).then(() => {
          loadIndicator.style.display = 'none';
          if (!individual.scroll) {
            window.scrollTo(0, 0);
          }
        });
      } else {
        $('#main').empty();
        main.present('#main').then(() => loadIndicator.style.display = 'none');
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
    } if (!Number.isNaN(Date.parse(value))) {
      return new Date(value);
    } if (value === 'true') {
      return true;
    } if (value === 'false') {
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

    const layout_uri = veda.manifest.veda_layout;
    const main_uri = veda.manifest.veda_main;
    const {start_url} = veda.manifest;
    $('#app').empty();
    if (layout_uri && main_uri && start_url) {
      const layout = new IndividualModel(layout_uri);
      layout.present('#app')
        .then(() => new IndividualModel(main_uri).load())
        .then(installRouter)
        .then(() => riot.route(window.location.hash || start_url))
        .then(() => starting = false);
    } else {
      console.log('Incomplete layout params in manifest');
      const layout_param_uri = veda.user.hasValue('v-s:origin', 'ExternalUser') ? 'cfg:LayoutExternal' : 'cfg:Layout';
      const layout_param = new IndividualModel(layout_param_uri);
      const main_param_uri = veda.user.hasValue('v-s:origin', 'ExternalUser') ? 'cfg:MainExternal' : 'cfg:Main';
      const main_param = new IndividualModel(main_param_uri);
      layout_param.load()
        .then((layout_param) => layout_param['rdf:value'][0].load())
        .then((layout) => layout.present('#app'))
        .then(() => main_param.load())
        .then((main_param) => main_param['rdf:value'][0].load())
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
