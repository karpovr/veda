// Backend

import ServerBackend from '../common/backend_server.js';

import BrowserBackend from '../browser/backend_browser.js';

export default (typeof window === 'undefined' && typeof process === 'undefined' ? ServerBackend : BrowserBackend);
