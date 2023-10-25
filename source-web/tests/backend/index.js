import baretest from 'baretest';
import assert from 'assert';
import {readdir} from 'fs/promises';

import './polyfills.js';
import Backend from '../../js/browser/backend_browser.js';
import Helpers from './helpers.js';
import Constants from './constants.js';
import ServerUtil from '../../js/server/util.js';
import CommonUtil from '../../js/common/util.js';
const Util = {...ServerUtil, ...CommonUtil};

const test = baretest('Backend tests');
const re = /^test\d+\.js$/;

(async function () {
  const files = (await readdir('./tests/backend')).filter((f) => re.test(f));
  const modules = await Promise.all(files.map((file) => import('./' + file)));
  modules.forEach((module) => {
    const t = module.default;
    t({test, assert, Backend, Helpers, Constants, Util});
  });
  assert(await test.run());
})();
