// DOM Helpers

/**
 * Delegate event listener to ancestor element
 * @param {Element} el - Ancestor element
 * @param {string} event - Event ID
 * @param {string} delegateSelector - Delegate selector
 * @param {function} handler - Event handler
 * @param {boolean} useCapture - Whether to use capture phase or not
 * @return {function} - Function to remove the event listener
 */
function delegateHandler (el, event, delegateSelector, handler, useCapture) {
  el.addEventListener(event, ancestorHandler, useCapture);
  return () => el.removeEventListener(event, ancestorHandler, useCapture);

  /**
   * Event listener for ancestor element
   * @param {Event} e - Event
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
 * @param {HTMLElement} container - Container element to be cleared
 * @return {HTMLElement} - The cleared container element
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

/**
 * Sanitize a string by replacing special characters with their corresponding HTML entities
 * @param {string} string - The string to be sanitized
 * @return {string} - The sanitized string
 */
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

/**
 * Create a debounced function that executes after a certain time has passed without additional function calls
 * @param {function} f - The function to be debounced
 * @param {number} ms - The debounce delay in milliseconds
 * @return {function} - The debounced function
 */
function debounce (f, ms) {
  let skip = false;
  return function (...args) {
    if (skip) return;
    skip = true;
    setTimeout(() => skip = false, ms);
    return f(...args);
  };
}

/**
 * Create a delayed function that executes after a certain time has passed without additional function calls
 * @param {function} f - The function to be delayed
 * @param {number} ms - The delay time in milliseconds
 * @return {function} - The delayed function
 */
function delay (f, ms) {
  let wait;
  return function (...args) {
    clearTimeout(wait);
    wait = setTimeout(f, ms, ...args);
  };
}

/**
 * Create a decorator function that adds pre and post execution functions to a given function
 * @param {function} fn - The function to be decorated
 * @param {function} pre - Pre execution function
 * @param {function} post - Post execution function
 * @param {function} err - Error handling function
 * @return {function} - The decorated function
 */
function decorator (fn, pre, post, err) {
  return async function (...args) {
    try {
      if (pre && typeof pre === 'function') await pre.call(this, ...args);
      const result = await fn.call(this, ...args);
      if (post && typeof post === 'function') await post.call(this, ...args);
      return result;
    } catch (error) {
      if (err && typeof err === 'function') await err.call(this, ...args);
      throw error;
    }
  };
}

/**
 * Show the loading spinner
 * @return {void}
 */
function showSpinner () {
  document.getElementById('load-indicator').style.display = '';
}

/**
 * Hide the loading spinner
 * @return {void}
 */
function hideSpinner () {
  document.getElementById('load-indicator').style.display = 'none';
}

/**
 * Create a decorator function that shows and hides a loading spinner before and after the decorated function execution
 * @param {function} fn - The function to be decorated
 * @return {function} - The decorated function
 */
function spinnerDecorator (fn) {
  return decorator(fn, showSpinner, hideSpinner, hideSpinner);
}

/**
 * Show the cursor spinner
 * @return {void}
 */
function showCursorSpinner () {
  document.body.style.cursor = 'wait';
}

/**
 * Hide the cursor spinner
 * @return {void}
 */
function hideCursorSpinner () {
  document.body.style.cursor = 'default';
}

/**
 * Create a decorator function that sets and resets the cursor to a spinner during the decorated function execution
 * @param {function} fn - The function to be decorated
 * @return {function} - The decorated function
 */
function cursorDecorator (fn) {
  return decorator(fn, showCursorSpinner, hideCursorSpinner, hideCursorSpinner);
}

/**
 * Delay execution for a specified amount of time
 * @param {number} ms - The delay time in milliseconds
 * @return {Promise<void>} - A promise that resolves after the delay
 */
async function timeout (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export {
  delegateHandler,
  clear,
  sanitize,
  debounce,
  delay,
  decorator,
  spinnerDecorator,
  cursorDecorator,
  timeout,
};
