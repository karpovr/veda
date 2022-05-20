/* Riot 1.0.4, @license MIT, (c) 2014 Muut Inc + contributors */

const riot = {};

export default riot;

riot.observable = function (el) {
  if (el.on && el.one && el.off && el.trigger) {
    return el;
  }

  let callbacks = {};

  el.on = function (events, fn) {
    if (typeof fn === 'function') {
      events.replace(/[^\s]+/g, function (name, pos) {
        callbacks[name] = callbacks[name] || [];
        callbacks[name].push(fn);
        fn.typed = pos > 0;
      });
    }
    return el;
  };

  el.off = function (events, fn) {
    if (events === '*') callbacks = {};
    else if (fn) {
      events.replace(/[^\s]+/g, function (name) {
        if (callbacks[name]) {
          callbacks[name] = callbacks[name].filter(function (cb) {
            return cb !== fn;
          });
        }
      });
    } else {
      events.replace(/[^\s]+/g, function (name) {
        callbacks[name] = [];
      });
    }
    return el;
  };

  // only single event supported
  el.one = el.once = function (name, fn) {
    if (fn) fn.one = true;
    return el.on(name, fn);
  };

  el.trigger = el.emit = function (name, ...args) {
    const fns = callbacks[name] || [];
    let c = 0;
    return fns.reduce((p, fn, i) => p.then(() => {
      if (fn.one) {
        fns.splice(i - c, 1); c++;
      }
      return fn.apply(el, fn.typed ? [name].concat(args) : args);
    }), Promise.resolve()).then(() => el);
  };

  return el;
};

const FN = {}; // Precompiled templates (JavaScript functions)
const template_escape = {'\\': '\\\\', '\n': '\\n', '\r': '\\r', "'": "\\'"};
const render_escape = {'&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;'};

function default_escape_fn (str, key) {
  return str == null ? '' : (str+'').replace(/[&\"<>]/g, function (char) {
    return render_escape[char];
  });
}

riot.render = function (tmpl, data, escape_fn) {
  if (escape_fn === true) escape_fn = default_escape_fn;
  tmpl = tmpl || '';

  FN[tmpl] = FN[tmpl] || new Function('_', 'e', "return '" +
  tmpl.replace(/[\\\n\r']/g, function (char) {
    return template_escape[char];
  }).replace(/{\s*([\w\.]+)\s*}/g, "' + (e?e(_.$1,'$1'):_.$1||(_.$1==null?'':_.$1)) + '") + "'");

  return FN[tmpl](data, escape_fn);
};
/* Cross browser popstate */
(function () {
  // for browsers only
  if (typeof window === 'undefined') return;

  const pops = riot.observable({});
  const listen = window.addEventListener;

  function pop (hash) {
    hash = hash.type ? location.hash : hash;
    pops.trigger('pop', hash);
  }

  listen('popstate', pop, false);

  /* Change the browser URL or listen to changes on the URL */
  riot.route = function (to, prevent) {
    // listen
    if (typeof to === 'function') return pops.on('pop', to);

    // fire
    if (history.pushState) history.pushState(0, 0, to);
    if (!prevent) pop(to);
  };
})();
