// This is the "Simple offline" service worker

const veda_version = 20210416182334;

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
];
const NTLM = [
  '/ntlm',
  '/ntlm/',
  '/no',
  '/no/',
  '/ad',
  '/ad/',
];

addEventListener('message', (event) => {
  if (event.data === 'veda_version') {
    event.source.postMessage(veda_version);
  }
});

/**
 * Clear cached resources
 * @param {Event} event
 * @return {void}
 */
function clearCache(event) {
  self.skipWaiting();
  console.log(`Service worker updated, veda_version = ${veda_version}. Clear cache.`);
  event.waitUntil(
    caches.keys().then(function(keyList) {
      return Promise.all(keyList.map(function(key) {
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
  const isNTLM = NTLM.indexOf(pathname) >= 0;
  const isFILES = pathname.indexOf('/files') === 0;
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
function handleFetch(event, CACHE) {
  return caches.match(event.request).then(function(resp) {
    return resp || fetch(event.request).then(function(response) {
      if (response.ok) {
        return caches.open( CACHE ).then(function(cache) {
          cache.put(event.request, response.clone());
          return response;
        });
      }
      return response;
    });
  });
}
