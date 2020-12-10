// Application instance

import riot from '../common/lib/riot.js';

const veda = riot.observable({
  env: typeof window === 'undefined' ? 'server' : 'browser',
});

export default veda;
