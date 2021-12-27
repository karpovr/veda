const fs = require('fs');
let files = require('./files.js');

const OPTIONS = JSON.parse(fs.readFileSync('./options.json'));

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

let clients = [];

const changesHandler = (request, response, next) => {
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  };
  response.writeHead(200, headers);

  const data = `data: ${JSON.stringify(files.getState())}\n\n`;

  response.write(data);

  const clientId = Date.now();

  const newClient = {
    id: clientId,
    response
  };

  clients.push(newClient);

  console.log(`${clientId} connection opened`);

  request.on('close', () => {
    console.log(`${clientId} connection closed`);
    clients = clients.filter((client) => client.id !== clientId);
  });
};

const propagateChange = (change) => {
  console.log(new Date().toISOString(), `File changed: ${JSON.stringify(change)}`);
  clients.forEach((client) => client.response.write(`data: ${JSON.stringify(change)}\n\n`));
}
files.watchChanges(propagateChange);

app.get('/clients', (request, response) => response.json({clients: clients.length}));
app.get('/changes', changesHandler);

app.listen(
  OPTIONS.port,
  OPTIONS.host,
  () => {
    console.log(new Date().toISOString(), `App files changes service started on ${OPTIONS.host}:${OPTIONS.port}`);
    console.log(new Date().toISOString(), `Initial state =`, files.getState());
  },
);
