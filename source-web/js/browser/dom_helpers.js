// DOM Helpers

/**
 * Delegate event listener to ancestor element
 * @param {Element} el - ancestor element
 * @param {string} event - event id
 * @param {string} delegateSelector - delegate selector
 * @param {function} handler - event handler
 * @param {boolean} useCapture
 * @return {void}
 */
function delegateHandler (el, event, delegateSelector, handler, useCapture) {
  el.addEventListener(event, ancestorHandler, useCapture);
  return (() => el.removeEventListener(event, ancestorHandler, useCapture));
  /**
   * Event listener for ancestor element
   * @param {Event} e - event
   * @return {void}
   * @this Element
   */
  function ancestorHandler (e) {
    for (let {target} = e; target && target !== this; target = target.parentNode) {
      if (target.matches(delegateSelector)) {
        handler.call(target, e);
        break;
      }
    }
  }
}

/**
 * Clear container
 * @param {HTMLElement} container
 * @return {HTMLElement}
 */
function clear (container) {
  const childrenTemplates = container.querySelectorAll('.template');
  const childrenControls = container.querySelectorAll('veda-control');
  const event = new Event('remove');
  childrenTemplates.forEach((template) => {
    template.dispatchEvent(event);
  });
  childrenControls.forEach((control) => {
    control.dispatchEvent(event);
  });
  container.innerHTML = '';
  return container;
}

function sanitize (string) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  const reg = /[&<>"'/]/gi;
  return String(string).replace(reg, function (match) {
    return map[match];
  });
}

function debounce (f, ms) {
  let skip = false;
  return function (...args) {
    if (skip) return;
    skip = true;
    setTimeout(() => skip = false, ms);
    return f(...args);
  };
}

function delay (f, ms) {
  let wait;
  return function (...args) {
    clearTimeout(wait);
    wait = setTimeout(f, ms, ...args);
  };
}

function decorator (fn, pre, post, err) {
  return async function (...args) {
    try {
      pre && typeof pre === 'function' && await pre.call(this, ...args);
      const result = await fn.call(this, ...args);
      post && typeof post === 'function' && await post.call(this, ...args);
      return result;
    } catch (error) {
      err && typeof err === 'function' && await err.call(this, ...args);
      throw error;
    }
  };
}

function showSpinner () {
  document.getElementById('load-indicator').style.display = '';
}

function hideSpinner () {
  document.getElementById('load-indicator').style.display = 'none';
}

function spinnerDecorator (fn) {
  return decorator(fn, showSpinner, hideSpinner, hideSpinner);
}

async function timeout (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export {delegateHandler, clear, sanitize, debounce, delay, decorator, spinnerDecorator, timeout};
