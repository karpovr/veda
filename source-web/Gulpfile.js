const {src, dest} = require('gulp');
const rename = require('gulp-rename');
const through2 = require('through2');
const mkdirp = require('mkdirp');
const minify = require('html-minifier').minify;
const sourcemaps = require('gulp-sourcemaps');
const babel = require('gulp-babel');

const babel_options = {
  plugins: [
    '@babel/plugin-transform-instanceof',
    '@babel/plugin-transform-modules-systemjs',
  ],
  presets: [
    [
      '@babel/preset-env',
      {
        useBuiltIns: 'entry',
        corejs: 3,
        targets: '> 0.25%, not dead',
      },
    ],
    [
      'minify',
      {
        'booleans': true,
        'builtIns': false,
        'consecutiveAdds': true,
        'deadcode': true,
        'evaluate': false,
        'flipComparisons': true,
        'guards': true,
        'infinity': true,
        'mangle': true,
        'memberExpressions': true,
        'mergeVars': true,
        'numericLiterals': true,
        'propertyLiterals': true,
        'regexpConstructors': true,
        'removeConsole': false,
        'removeDebugger': true,
        'removeUndefined': true,
        'replace': true,
        'simplify': true,
        'simplifyComparisons': true,
        'typeConstructors': true,
        'undefinedToVoid': true,
      },
    ],
  ],
};

const minify_options = {
  collapseWhitespace: true,
  collapseInlineTagWhitespace: true,
  conservativeCollapse: true,
  minifyCSS: true,
  quoteCharacter: '"',
  removeComments: true,
};

exports.default = function () {
  return src('../ontology/**/*.js', {follow: true})
    .pipe(rename((path) => {
      path.dirname = '';
      //path.extname = '.js';
    }))
    //.pipe(through2.obj(transform_to_es6))
    //.pipe(through2.obj(transform_to_module))
    // .pipe(sourcemaps.init())
    //  .pipe(sourcemaps.mapSources(function(sourcePath, file) {
    //    console.log('sourcePath', sourcePath);
    //    return '/templates/' + sourcePath;
    //  }))
    //  .pipe(babel(babel_options))
    //.pipe(sourcemaps.write('.'))*/
    .pipe(dest('templates'));
};

mkdirp.sync('templates');

const import_other = {
  'veda.Backend': '/js/common/backend.js',
  'veda.BPMN': '/js/server/bpmn.js',
  'veda.Codelet': '/js/server/codelets.js',
  'veda.IndividualModel': '/js/common/individual_model.js',
  'veda.Notify': '/js/browser/notify.js',
  'veda.Util': '/js/common/util.js',
  'Sha256': 'sha256',
  'riot': 'riot',
};

const re_veda = /veda\./gm;

const re_import_other = new RegExp(`(${Object.keys(import_other).join('|')})`, 'gm');

const transform_to_es6 = (file, _, cb) => {
  if (file.isBuffer()) {
    const content = file.contents.toString();
    const match = content.trim().match(/^(?:<script[^>]*>([\s\S]*?)<\/script>)?([\s\S]*?)(?:<script[^>]*>(?![\s\S]*<script[^>]*>)([\s\S]*)<\/script>)?$/i);
    let pre = (match[1] ?? '').trim();
    let post = (match[3] ?? '').trim();
    const html = (match[2] ?? '').trim();

    try {
      const patch = `template = $(template);\n  container = $(container);`;
      const to_import = {};
      if (pre) {
        if (re_import_other.test(pre)) {
          pre = pre.replace(re_import_other, function (imported) {
            const stemmed = imported.substr(imported.indexOf('.') + 1);
            to_import[stemmed] = import_other[imported];
            return stemmed;
          });
        }
        pre = `export const pre = function (individual, template, container) {\n  ${patch}\n\n  ${pre}\n};`;
      }
      if (post) {
        if (re_import_other.test(post)) {
          post = post.replace(re_import_other, function (imported) {
            const stemmed = imported.substr(imported.indexOf('.') + 1);
            to_import[stemmed] = import_other[imported];
            return stemmed;
          });
        }
        post = `export const post = function (individual, template, container) {\n  ${patch}\n\n  ${post}\n};`;
      }
      let head = Object.keys(to_import).map((imported) => `import ${imported} from '${to_import[imported]}';`).join('\n');

      if (re_veda.test(pre) || re_veda.test(post)) {
        head = `import veda from '/js/common/veda.js';\n${head}`;
      }
      head = `import $ from 'jquery';\n${head}`;
      const script = (pre || post) ? ['<script>', [head.trim(), pre.trim(), post.trim()].filter(Boolean).join('\n\n'), '</script>'].filter(Boolean).join('\n') : '';
      const result = [script, html].filter(Boolean).join('\n');
      const transformed = result.trim();
      file.contents = Buffer.from(transformed);
    } catch (e) {
      console.log(file.basename, e);
    }
  }
  cb(null, file);
};


const transform_to_module = (file, _, cb) => {
  if (file.isBuffer()) {
    const content = file.contents.toString();
    const match = content.trim().match(/^(?:<script[^>]*>([\s\S]*?)<\/script>)?([\s\S]*?)$/i);
    let script = (match[1] ?? '').trim();
    const html = (match[2] ?? '').trim();
    // html = minify(html, minify_options);
    script = `${script ? script + '\n\n' : ''}export const html = \`\n${html}\n\`;`;
    file.contents = Buffer.from(script);
  }
  cb(null, file);
};

