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
  // Loop through all the files in the temp directory
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

/* =========================== UTILITIES =========================== */

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
  const templateRE = /^([a-z][a-z-0-9]*:[a-zA-Z0-9-_]*)$((?:\n +[a-z][a-z-0-9]*:[a-zA-Z0-9-_]* +[^\n]*$)*)\n +v-ui:template +"""(.*?)"""/gmis;
  if ( ttlRE.test(filePath) ) {
    console.log('Extracting templates from file:', filePath);
    let content = fs.readFileSync(filePath, {encoding: 'utf8', flag: 'r'});

    content = content.replace(templateRE, function (match, templateUri, otherProps, templateContent) {
      const templateFileName = templateUri.replace(':', '_') + '.html';
      const templateFilePath = [dir, templateFileName].join('/');
      templateContent = templateContent.trim();
      fs.writeFileSync(templateFilePath, templateContent, 'utf-8');
      return templateUri + otherProps + '\n  v-ui:template "' + templateFileName + '"';
    });
  }
}

/**
 * Template remover function
 *
 */
function templateRemover(dir, file) {
  const filePath = [dir, file].join('/');
  const ttlRE = /\.ttl$/i;
  const templateRE = /^([a-z][a-z-0-9]*:[a-zA-Z0-9-_]*)$((?:\n +[a-z][a-z-0-9]*:[a-zA-Z0-9-_]* +[^\n]*$)*)\n +v-ui:template +"""(.*?)"""\s*?;\s*?\n\s*\.\n*/gmis;
  if ( ttlRE.test(filePath) ) {
    console.log('Removing templates from file:', filePath);
    let content = fs.readFileSync(filePath, {encoding: 'utf8', flag: 'rs+'});
    content = content.replace(templateRE, '');
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

/**
 * Template replacer function
 *
 */
function templateToFileReplacer(dir, file) {
  const filePath = [dir, file].join('/');
  const filter = /\.(ttl|html)$/i;
  const templateRE = /^\s*v-ui:hasTemplate +(.*?)\s*?;\s*?\n\s*\./gmis;
  if ( filter.test(filePath) ) {
    console.log('Replacing templates uris to files in file:', filePath);
    let content = fs.readFileSync(filePath, {encoding: 'utf8', flag: 'rs+'});
    content = content.replace(templateRE, function (match, templateUri) {
      const templateFileName = templateUri.replace(':', '_') + '.html';
    });

    fs.writeFileSync(filePath, content, 'utf-8');
  }
}
