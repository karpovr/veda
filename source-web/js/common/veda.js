// Application instance

import riot from '../common/lib/riot.js';

const veda = riot.observable({
  env: typeof this.window === 'undefined' && typeof this.process === 'undefined' ? 'server' : 'browser',
});

export default veda;
