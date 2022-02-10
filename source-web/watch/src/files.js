import fs from 'fs';
import chokidar from 'chokidar';
import anymatch from 'anymatch';

const OPTIONS = JSON.parse(fs.readFileSync('./options.json'));
const root = OPTIONS.root;
const ignored = OPTIONS.ignored;

const setState = (dir, state = {}, root) => {
  root = root || dir ;
  const files = fs.readdirSync(dir);
  for (const file in files) {
    const name = dir + '/' + files[file];
    let stat;
    try {
      stat = fs.statSync(name);
    } catch (err) {
      console.log(`Skip file due to stat file error: ${err}`);
      continue;
    }
    if (stat.isDirectory() && !anymatch(ignored, name)) {
      setState(name, state, root);
    } else {
      state[name.substr(root.length)] = stat.mtime.toGMTString();
    }
  }
  return state;
};

const getState = function() {
  return state;
};

const watchChanges = function(handler) {
  handlers.push(handler);
};

const callHandlers = (path, stat) => {
  if (anymatch(ignored, path)) return;
  const change = {[`/${path.substr(root.length)}`]: stat.mtime.toGMTString()};
  state = {...state, ...change};
  handlers.forEach(handler => handler(change));
};

let state = setState(root);

let handlers = [];

chokidar.watch(root, {
  ignored: ignored,
  ignoreInitial: true,
}).on('add', callHandlers).on('change', callHandlers);

export default { getState, watchChanges };