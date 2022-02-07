// Backend

import veda from '../common/veda.js';

import ServerBackend from '../common/backend_server.js';

import BrowserBackend from '../browser/backend_browser.js';

export default veda.Backend = ( veda.env === 'server' ? ServerBackend : BrowserBackend );
