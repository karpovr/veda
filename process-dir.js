/**
 * Utility script for processing all files in a directory and its subdirectories
 *
 * Usage:
 * node process-dir.js DIR [FN...]
 * DIR - directory to process
 * FN - name of a function to apply to each file in directory
 *
 * Example:
 * node process-dir.js 1 templateExtractor
 * node process-dir.js 1 templateRemover
 * node process-dir.js 1 uriToFileReplacerTTL uriToFileReplacerHTML
 *
 */

const fs = require('fs');
const process = require('process');

const rootDirectory = process.argv[2];
if (!rootDirectory) {
  console.error('Specify directory to process.');
  process.exit(1);
}

let processors = process.argv.slice(3);
if (!processors.length) {
  processors = [printer];
  console.log('Default processor is "printer". Specify processor.');
} else {
  console.log('processors:', processors);
  processors = processors.map(name => eval(name));
}

processDirectory(rootDirectory, ...processors);

/**
 * Function to process all files in a directory
 * @param {string} directory
 * @param {function} processFn
 * @return {void}
 */
function processDirectory(dir, ...processFns) {
  fs.readdir(dir, function (err, files) {
    if (err) {
      console.error('Could not list the directory.', err);
      process.exit(1);
    }

    files.forEach(function (file) {
      const filePath = [dir, file].join('/');
      fs.stat(filePath, function (error, stat) {
        if (error) {
          console.error('Error stating file.', error);
          return;
        }
        if (stat.isFile()) {
          processFns.forEach(fn => fn(dir, file));
        } else if (stat.isDirectory()) {
          processDirectory(filePath, ...processFns);
        }
      });
    });
  });
}

/* =============================== FN =============================== */

/**
 * Simple filename printer
 *
 */
function printer(dir, file) {
  console.log(dir, file);
}

/**
 * Template extractor function
 *
 */
function templateExtractor(dir, file) {
  const filePath = [dir, file].join('/');
  const ttlRE = /\.ttl$/i;
  const templateRE = /^\s*([a-z][a-z-0-9]*:[a-zA-Z0-9-_]*)\s*$((?:[\s#]*[a-z][a-z-0-9]*:[a-zA-Z0-9-_]*\s+[^\n]*$)*)\s*v-ui:template\s+"""(.*?)"""/gmis;
  if ( ttlRE.test(filePath) ) {
    console.log('Extracting templates from file:', filePath);
    let counter = 0;
    let content = fs.readFileSync(filePath, {encoding: 'utf8', flag: 'rs+'});
    content = content.replace(templateRE, function (match, templateUri, otherProps, templateContent) {
      const templateFileName = templateUri.replace(':', '_') + '.html';
      const templatesDir = [dir, 'templates'].join('/');
      if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir);
      }
      const templateFilePath = [templatesDir, templateFileName].join('/');
      templateContent = templateContent.trim();
      fs.writeFileSync(templateFilePath, templateContent, 'utf-8');
      counter++;
      return templateUri + otherProps + '\n  v-ui:template "' + templateFileName + '"';
    });
    console.log(`Extracted ${counter} templates`);
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

/**
 * Template remover function
 *
 */
function templateRemover(dir, file) {
  const filePath = [dir, file].join('/');
  const ttlRE = /\.ttl$/i;
  const templateRE = /^\s*([a-z][a-z-0-9]*:[a-zA-Z0-9-_]*)\s*$((?:[\s#]*[a-z][a-z-0-9]*:[a-zA-Z0-9-_]*\s+[^\n]*$)*)\s*v-ui:template\s+"(.*?)"\s*;?\s*\.\n*/gmis;
  if ( ttlRE.test(filePath) ) {
    console.log('Removing templates from file:', filePath);
    let counter = 0;
    let content = fs.readFileSync(filePath, {encoding: 'utf8', flag: 'rs+'});
    content = content.replace(templateRE, (match) => {
      counter++;
      return '';
    });
    console.log(`Removed ${counter} templates`);
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

/**
 * Template uri to filename replacer function
 *
 */
function uriToFileReplacerTTL(dir, file) {
  const filePath = [dir, file].join('/');
  const filter = /\.ttl$/i;
  const templateRE = / *(v-ui:hasTemplate|v-ui:defaultTemplate) +([a-z][a-z-0-9]*:[a-zA-Z0-9-_]*) *(?:;|\n)/gi;
  if ( filter.test(filePath) ) {
    console.log('Replacing templates URIs to files in file:', filePath);
    let counter = 0;
    let content = fs.readFileSync(filePath, {encoding: 'utf8', flag: 'rs+'});
    content = content.replace(templateRE, function (match, predicate, templateUri) {
      const templateFileName = templateUri.replace(':', '_') + '.html';
      counter++;
      return `  ${predicate} "${templateFileName}" ;`;
    });
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Replaced ${counter} URIs`);
  }
}

/**
 * Template uri to filename replacer function
 *
 */
function uriToFileReplacerHTML(dir, file) {
  const filePath = [dir, file].join('/');
  const filter = /\.html$/i;
  const templateRE = /data-template="([a-z][a-z-0-9]*:[a-zA-Z0-9-_]*)"/gi;
  if ( filter.test(filePath) ) {
    console.log('Replacing templates URIs to files in file:', filePath);
    let counter = 0;
    let content = fs.readFileSync(filePath, {encoding: 'utf8', flag: 'rs+'});
    content = content.replace(templateRE, function (match, templateUri) {
      const templateFileName = templateUri.replace(':', '_') + '.html';
      counter++;
      return `data-template="${templateFileName}"`;
    });
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Replaced ${counter} URIs`);
  }
}
