// This is the "Simple offline" service worker

const veda_version = 20210416202615;
const changesTimeout = 60 * 1000;
const FILES = 'files';
const STATIC = 'static';
const API = [
  '/ping',
  '/get_rights',
  '/get_rights_origin',
  '/get_membership',
  '/authenticate',
  '/get_ticket_trusted',
  '/is_ticket_valid',
  '/get_operation_state',
  '/wait_module',
  '/query',
  '/get_individual',
  '/get_individuals',
  '/remove_individual',
  '/put_individual',
  '/add_to_individual',
  '/set_in_individual',
  '/remove_from_individual',
  '/put_individuals',
  '/changes',
];

/**
 * Listen to cached resources changes
 */
function listenChanges () {
  const events = new EventSource('/changes');

  events.onopen = function (event) {
    console.log(new Date().toISOString(), 'Listening to resources changes');
  };

  events.onerror = function (event) {
    console.error(new Date().toISOString(), `Failed to listen to resources changes, reconnect in ${Math.floor(changesTimeout / 1000)} sec`);
    event.target.close();
    setTimeout(listenChanges, 60 * 1000);
  };

  events.onmessage = function (event) {
    const change = JSON.parse(event.data);
    for (let path in change) {
      path = (path === '/index.html' ? '/' : path);
      caches.match(path).then(function (response) {
        if (response && response.ok) {
          const cache_modified = response.headers.get('last-modified');
          const event_modified = change[path];
          if (cache_modified !== event_modified) {
            caches.open(STATIC).then(function (cache) {
              return cache.delete(path);
            }).then(function () {
              console.log(new Date().toISOString(), 'Cached resource deleted: ', path);
            });
          }
        }
      });
    }
  };
}
listenChanges();

/**
 * Listen to messages from client
 */
addEventListener('message', function (event) {
  if (event.data === 'version') {
    event.source.postMessage({version: veda_version});
  }
});

/**
 * Clear cached resources
 * @param {Event} event
 * @return {void}
 */
function clearCache (event) {
  self.skipWaiting();
  console.log(`Service worker updated, veda_version = ${veda_version}, clear cache`);
  event.waitUntil(
    caches.keys().then(function (keyList) {
      return Promise.all(keyList.map(function (key) {
        return caches.delete(key);
      }));
    }),
  );
}
self.addEventListener('install', clearCache);

self.addEventListener('fetch', function (event) {
  const url = new URL(event.request.url);
  const pathname = url.pathname;
  const isAPI = API.indexOf(pathname) >= 0;
  const isFILES = pathname.indexOf('/files') === 0;
  const isNTLM = pathname.indexOf('/ntlm') === 0;
  const isSTATIC = !isAPI && !isFILES && !isNTLM;
  if (event.request.method === 'GET') {
    if (isSTATIC) {
      event.respondWith(handleFetch(event, STATIC));
    } else if (isFILES) {
      event.respondWith(handleFetch(event, FILES));
    }
  }
});

/**
 * Fetch event handler
 * @param {Event} event
 * @param {string} CACHE
 * @return {Promise<Response>}
 */
function handleFetch (event, CACHE) {
  const path = new URL(event.request.url).pathname;
  return caches.match(path).then(function (response) {
    return response || fetch(event.request).then(function (response) {
      if (response.ok) {
        return caches.open( CACHE ).then(function (cache) {
          cache.put(path, response.clone());
          return response;
        });
      }
      return response;
    });
  });
}
