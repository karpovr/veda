import riot from '../common/lib/riot.js';

import {delegateHandler} from '../browser/dom_helpers.js';

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
