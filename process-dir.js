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
const fsAsync = fs.promises;
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

console.time('duration');
processDirectory(rootDirectory, ...processors).then(() => console.timeEnd('duration'));

/**
 * Function to process all files in a directory
 * @param {string} directory
 * @param {function} processFn
 * @return {void}
 */
async function processDirectory(dir, ...processors) {
  try {
    const entries = await fsAsync.readdir(dir);
    return Promise.all(entries.map(processEntry));
  } catch (err) {
    console.error('Could not list the directory.', err);
    process.exit(1);
  }

  async function processEntry(entry) {
    const entryPath = [dir, entry].join('/');
    try {
      const stat = await fsAsync.stat(entryPath);
      if (stat.isFile()) {
        return processors.reduce((p, fn) => p.then(() => fn(dir, entry)), Promise.resolve());
      } else if (stat.isDirectory()) {
        return processDirectory(entryPath, ...processors);
      }
    } catch (err) {
      console.error('Error stating file.', error);
      return;
    }
  }
}

/* =============================== FN =============================== */

/**
 * Simple filename printer
 *
 */
async function printer(dir, file) {
  console.log(`${dir}/${file}`);
}

/**
 * Template extractor function
 *
 */
async function templateExtractor(dir, file) {
  const filePath = [dir, file].join('/');
  const ttlRE = /\.ttl$/i;
  const templateRE = /^\s*([a-z][a-z-0-9]*:[a-zA-Z0-9-_]*)\s*$((?:[\s#]*[a-z][a-z-0-9]*:[a-zA-Z0-9-_]*\s+[^\n]*$)*)\s*v-ui:template\s+"""(.*?)"""/gmis;
  if ( ttlRE.test(filePath) ) {
    console.log('Extracting templates from file:', filePath);
    let counter = 0;
    try {
      let content = await fsAsync.readFile(filePath, {encoding: 'utf8', flag: 'rs+'});
      const templatesDir = [dir, 'templates'].join('/');
      const templatesDirExists = fs.existsSync(templatesDir);
      content = content.replace(templateRE, function (match, templateUri, otherProps, templateContent) {
        const templateFileName = templateUri.replace(':', '_') + '.html';
        if (!counter && !templatesDirExists) {
          try {
            fs.mkdirSync(templatesDir);
          } catch (err) {
            console.log(`Error creating templates directory`, err);
          }
        }
        const templateFilePath = [templatesDir, templateFileName].join('/');
        templateContent = templateContent.trim();
        try {
          fs.writeFileSync(templateFilePath, templateContent, 'utf-8');
          counter++;
        } catch (err) {
          console.log(`Error creating template file`, err);
        }
        return templateUri + otherProps + '\n  v-ui:template "' + templateFileName + '"';
      });
      await fsAsync.writeFile(filePath, content, 'utf-8');
      console.log(`Extracted ${counter} templates`);
    } catch (err) {
      console.log(`Error reading/writing TTL file ${filePath}`, err);
    }
  }
}

/**
 * Template remover function
 *
 */
async function templateRemover(dir, file) {
  const filePath = [dir, file].join('/');
  const ttlRE = /\.ttl$/i;
  const templateRE = /^\s*([a-z][a-z-0-9]*:[a-zA-Z0-9-_]*)\s*$((?:[\s#]*[a-z][a-z-0-9]*:[a-zA-Z0-9-_]*\s+[^\n]*$)*)\s*v-ui:template\s+"(.*?)"\s*;?\s*\.\n*/gmis;
  if ( ttlRE.test(filePath) ) {
    console.log('Removing templates from file:', filePath);
    let counter = 0;
    try {
      let content = await fsAsync.readFile(filePath, {encoding: 'utf8', flag: 'rs+'});
      content = content.replace(templateRE, (match) => {
        counter++;
        return '';
      });
      await fsAsync.writeFile(filePath, content, 'utf-8');
      console.log(`Removed ${counter} templates`);
    } catch (err) {
      console.log(`Error reading/writing TTL file ${filePath}`, err);
    }
  }
}

/**
 * Template uri to filename replacer function
 *
 */
async function uriToFileTTL(dir, file) {
  const filePath = [dir, file].join('/');
  const filter = /\.ttl$/i;
  const templateRE = / *(v-ui:hasTemplate|v-ui:defaultTemplate|v-fs:searchBlankTemplate|v-fs:searchResultTemplate) +([a-z][a-z-0-9]*:[a-zA-Z0-9-_]*) *(?:;|\n)/gi;
  if ( filter.test(filePath) ) {
    console.log('Replacing templates URIs to files in file:', filePath);
    let counter = 0;
    try {
      let content = await fsAsync.readFile(filePath, {encoding: 'utf8', flag: 'rs+'});
      content = content.replace(templateRE, function (match, predicate, templateUri) {
        const templateFileName = templateUri.replace(':', '_') + '.html';
        counter++;
        return `  ${predicate} "${templateFileName}" ;`;
      });
      await fsAsync.writeFile(filePath, content, 'utf-8');
      console.log(`Replaced ${counter} URIs`);
    } catch (err) {
      console.log(`Error reading/writing TTL file ${filePath}`, err);
    }
  }
}

/**
 * Template uri to filename replacer function
 *
 */
async function uriToFileHTML(dir, file) {
  const filePath = [dir, file].join('/');
  const filter = /\.html$/i;
  const templateRE = /data-template="([a-z][a-z-0-9]*:[a-zA-Z0-9-_]*)"/gi;
  if ( filter.test(filePath) ) {
    console.log('Replacing templates URIs to files in file:', filePath);
    let counter = 0;
    try {
      let content = await fsAsync.readFile(filePath, {encoding: 'utf8', flag: 'rs+'});
      content = content.replace(templateRE, function (match, templateUri) {
        const templateFileName = templateUri.replace(':', '_') + '.html';
        counter++;
        return `data-template="${templateFileName}"`;
      });
      await fsAsync.writeFile(filePath, content, 'utf-8');
      console.log(`Replaced ${counter} URIs`);
    } catch (err) {
      console.log(`Error reading/writing HTML file ${filePath}`, err);
    }
  }
}

/**
 * Template uri to filename replacer function
 * function checks if corresponding filename exists in public/templates directory
 */
async function uriToFile(dir, file) {
  const filePath = [dir, file].join('/');
  const filter = /\.(ttl|html)$/i;
  const templateRE = /('|")([a-z][a-z-0-9]*:[a-zA-Z0-9-_]*Template)('|")/gi;
  if ( filter.test(filePath) ) {
    console.log('Replacing templates URIs to filenames in file:', filePath);
    let counter = 0;
    try {
      let content = await fsAsync.readFile(filePath, {encoding: 'utf8', flag: 'rs+'});
      content = content.replace(templateRE, function (match, beg, templateUri, end) {
        const templateFileName = templateUri.replace(':', '_') + '.html';
        const templateFilePath = process.env.PWD + '/public/templates/' + templateFileName;
        const templateFileExists = fs.existsSync(templateFilePath);
        console.log(templateFileName, templateFilePath, templateFileExists);
        if (templateFileExists) {
          counter++;
          return beg + templateFileName + end;
        }
        return match;
      });
      await fsAsync.writeFile(filePath, content, 'utf-8');
      console.log(`Replaced ${counter} URIs`);
    } catch (err) {
      console.log(`Error reading/writing file ${filePath}`, err);
    }
  }
}
