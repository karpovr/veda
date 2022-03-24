import fs from 'fs';
import chokidar from 'chokidar';
import anymatch from 'anymatch';

const OPTIONS = JSON.parse(fs.readFileSync('./options.json'));
const root = OPTIONS.root;
const ignored = OPTIONS.ignored;

const setState = (dir, rootParam, stateParam = {}) => {
  rootParam = rootParam || dir;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = dir + '/' + file;
    let stat;
    try {
      stat = fs.statSync(name);
    } catch (err) {
      console.error(`Skip file due to stat file error, file: ${name}`);
      continue;
    }
    if (stat.isDirectory() && !anymatch(ignored, name)) {
      setState(name, rootParam, stateParam);
    } else {
      stateParam[name.substring(rootParam.length)] = stat.mtime.toGMTString();
    }
  }
  return stateParam;
};

const getState = function () {
  return state;
};

const watchChanges = function (handler) {
  handlers.push(handler);
};

const callHandlers = (path, stat) => {
  if (anymatch(ignored, path)) return;
  const change = {[`/${path.substr(root.length)}`]: stat.mtime.toGMTString()};
  state = {...state, ...change};
  handlers.forEach((handler) => handler(change));
};

let state = setState(root);

const handlers = [];

chokidar.watch(root, {
  ignored: ignored,
  ignoreInitial: true,
}).on('add', callHandlers).on('change', callHandlers);

export default {getState, watchChanges};
