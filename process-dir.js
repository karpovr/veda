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
function templateExtractor(fileName) {
  const ttlRE = /\.ttl$/i;
  const templateRE = /v-ui:template\s+"""(.*?)"""/gmis;
  if ( ttlRE.test(fileName) ) {
    console.log('Processing file:', fileName);
    const content = fs.readFileSync(fileName, {encoding: 'utf8', flag: 'r'});
    const templates = content.match(templateRE);
    if (templates !== null) {
      console.log(templates[0]);
    }
  }
}

/**
 * Simple print processor
 *
 */
function printer(fileName) {
  console.log(fileName);
}

/**
 * Function to process all files in a directory
 * @param {string} directory
 * @param {function} processFn
 * @return {void}
 */
function processDirectory(directory, processFn) {
  // Loop through all the files in the temp directory
  fs.readdir(directory, function (err, files) {
    if (err) {
      console.error('Could not list the directory.', err);
      process.exit(1);
    }

    files.forEach(function (file) {
      const filePath = [directory, file].join('/');
      fs.stat(filePath, function (error, stat) {
        if (error) {
          console.error('Error stating file.', error);
          return;
        }
        if (stat.isFile()) {
          processFn(filePath);
        } else if (stat.isDirectory()) {
          processDirectory(filePath, processFn);
        }
      });
    });
  });
}


