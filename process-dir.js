const fs = require('fs');
const process = require('process');

const rootDirectory = process.argv[2];

if (!rootDirectory) {
  console.error('Specify directory to process.');
  process.exit(1);
}
processDirectory(rootDirectory, templateExtractor);

/**
 * Template extractor function
 *
 */
function templateExtractor(dir, file) {
  const filePath = [dir, file].join('/');
  const ttlRE = /\.ttl$/i;
  const templateRE = /^([a-z][a-z-0-9]*:[a-zA-Z0-9-_]*)$((?:\n +[a-z][a-z-0-9]*:[a-zA-Z0-9-_]* +[^\n]*$)*)\n +v-ui:template +"""(.*?)"""/gmis;
  if ( ttlRE.test(filePath) ) {
    console.log('Processing file:', filePath);
    let content = fs.readFileSync(filePath, {encoding: 'utf8', flag: 'r'});

    content = content.replace(templateRE, function (match, templateUri, otherProps, templateContent) {
      const templateFileName = templateUri.replace(':', '_') + '.html';
      const templateFilePath = [dir, templateFileName].join('/');
      templateContent = templateContent.trim();
      fs.writeFileSync(templateFilePath, templateContent, 'utf-8');
      return templateUri + otherProps + '\n  v-ui:template "' + templateFileName + '"';
    });

    console.log(content);

    /*const templates = content.match(templateRE);
    if (templates !== null) {
      console.log(templates);
    }*/
  }
}

/**
 * Simple print processor
 *
 */
function printer(dir, file) {
  console.log(dir, file);
}

/**
 * Function to process all files in a directory
 * @param {string} directory
 * @param {function} processFn
 * @return {void}
 */
function processDirectory(dir, processFn) {
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
          processFn(dir, file);
        } else if (stat.isDirectory()) {
          processDirectory(filePath, processFn);
        }
      });
    });
  });
}


