// DOM Helpers

/**
 * Delegate event listener to ancestor element
 * @param {Element} el - ancestor element
 * @param {string} event - event id
 * @param {string} delegateSelector - delegate selector
 * @param {function} handler - event handler
 * @return {void}
 */
function delegateHandler(el, event, delegateSelector, handler, useCapture) {
  el.addEventListener(event, ancestorHandler, useCapture);

  /**
   * Event listener for ancestor element
   * @param {Event} event - event
   * @return {void}
   * @this Element
   */
  function ancestorHandler(event) {
    for (let {target} = event; target && target !== this; target = target.parentNode) {
      if (target.matches(delegateSelector)) {
        handler.call(target, event);
        break;
      }
    }
  }
}

export {delegateHandler};
