// Backend

import veda from '../common/veda.js';

import serverBackend from '../common/backend_server.js';

import browserBackend from '../browser/backend_browser.js';

export default veda.Backend = ( veda.env === 'server' ? serverBackend : browserBackend );
