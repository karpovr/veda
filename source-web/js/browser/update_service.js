// Update service for individuals that were changed on server

'use strict';

import veda from '../common/veda.js';

import IndividualModel from '../common/individual_model.js';

import Backend from '../common/backend.js';

export default UpdateService;

/**
 * Client in memory cache update service singleton constructor
 * @return {Promise} update service instance promise
 */
function UpdateService () {
  const self = this;

  // Singleton pattern
  if (UpdateService.prototype._singletonInstance) {
    return UpdateService.prototype._singletonInstance;
  }

  this.list = {};
  const reconnectDelayInitial = 2500 + Math.round(Math.random() * 2500); // 2.5 - 5 sec
  const reconnectDelayFactor = 1.1;
  const reconnectDelayLimit = 5 * 60 * 1000; // 5 min
  const pingTimeout = 5000;

  let buffer = [];
  const socketDelay = 1000;
  let socketTimeout;
  let reconnectDelay = reconnectDelayInitial;
  let lastPing = Date.now();
  let pingInterval;

  return UpdateService.prototype._singletonInstance = initSocket();

  /**
   * Initialize instance
   * @return {Promise} instance promise
   */
  function initSocket () {
    return Backend.reset_individual(veda.ticket, 'cfg:ClientUpdateServicePort').then(function (ccusPortCfg) {
      const ccusPort = ccusPortCfg['rdf:value'] && ccusPortCfg['rdf:value'][0].data;
      const protocol = window.location.protocol === 'http:' ? 'ws:' : 'wss:';
      const port = ccusPort || window.location.port;
      const address = protocol + '//' + window.location.hostname + (port ? ':' + port : '') + '/ccus';
      const socket = new WebSocket(address);

      socket.onopen = openedHandler;
      socket.onclose = closedHandler;
      socket.onerror = errorHandler;
      socket.onmessage = messageHandler;
      socket.receiveMessage = receiveMessage;
      socket.sendMessage = sendMessage;
      self.socket = socket;
      return self;
    });
  }

  /**
   * Send a message via socket
   * @param {string} msg - message to send
   * @this UpdateService
   * @return {void}
   */
  function sendMessage (msg) {
    const socket = this;
    if (msg === '=' || msg === '-*' || msg.indexOf('ccus') === 0) {
      if (socket.readyState === 1) {
        socket.send(msg);
        // console.log("client -> server:", msg);
      }
      return;
    }
    buffer.push(msg);
    if ( !socketTimeout ) {
      socketTimeout = setTimeout(function () {
        const message = buffer.join(',');
        if (socket.readyState === 1) {
          socket.send(message);
          // console.log("client -> server:", message);
        }
        buffer = [];
        socketTimeout = undefined;
      }, socketDelay);
    }
  }

  /**
   * Receive a message via socket
   * @param {string} msg - received message
   * @return {void}
   */
  function receiveMessage (msg) {
    // console.log("server -> client:", msg);
    if (msg === '') {
      lastPing = Date.now();
      return;
    }
    let uris = msg.indexOf('=') === 0 ? msg.substr(1) : msg;
    if (uris.length === 0) {
      return;
    }
    uris = uris.split(',');
    for (let i = 0; i < uris.length; i++) {
      try {
        const tmp = uris[i].split('=');
        const uri = tmp[0];
        if ( !uri ) {
          continue;
        }
        const updateCounter = parseInt(tmp[1]);
        const individual = new IndividualModel(uri);
        if ( individual.hasValue('v-s:updateCounter', updateCounter) ) {
          continue;
        }
        if (self.list[uri]) {
          self.list[uri].updateCounter = updateCounter;
        }
        if (self.list[uri].action) {
          self.list[uri].action.call(individual, updateCounter); // Call action
        } else if (updateCounter !== 0) {
          individual.reset(); // Default action
        }
      } catch (error) {
        console.log('error: individual update service failed', error);
      }
    }
  }

  /**
   * Socket opened handler
   * @param {Event} event
   * @this UpdateService
   * @return {void}
   */
  function openedHandler (event) {
    reconnectDelay = reconnectDelayInitial;
    console.log('client: websocket opened', event.target.url);
    this.sendMessage('ccus=' + veda.ticket);
    self.restore();
    veda.trigger('ccus-online');

    pingInterval = setInterval(() => {
      if (Date.now() - lastPing > 2 * pingTimeout) {
        console.log('client: ping missed, close socket');
        veda.trigger('ccus-offline');
        clearInterval(pingInterval);
        this.close();
        return;
      }
    }, pingTimeout);
  }

  /**
   * Message received handler
   * @param {Event} event
   * @this WebSocket
   * @return {void}
   */
  function messageHandler (event) {
    const msg = event.data;
    this.receiveMessage(msg);
  }

  /**
   * Socket error handler
   * @param {Event} event
   * @this WebSocket
   * @return {void}
   */
  function errorHandler (event) {
    console.log('client: ccus error', event);
    this.close();
  }

  /**
   * Socket closed handler
   * @param {Event} event
   * @return {void}
   */
  function closedHandler (event) {
    reconnectDelay = reconnectDelay < reconnectDelayLimit ? reconnectDelay * reconnectDelayFactor : reconnectDelayLimit;
    console.log('client: websocket closed', event.target.url, '| re-connect in', reconnectDelay / 1000, 'sec');
    setTimeout(initSocket, reconnectDelay);
    veda.trigger('ccus-offline');
    clearInterval(pingInterval);
  }
};

const proto = UpdateService.prototype;

proto.subscribe = function (uri, action) {
  const self = this;
  if ( this.list[uri] ) {
    ++this.list[uri].subscribeCounter;
  } else {
    const individual = new IndividualModel(uri);
    individual.load()
      .catch(function (error) {
        console.log('subscribed individual load error', error);
      })
      .then(function () {
        const updateCounter = individual.hasValue('v-s:updateCounter') ? individual.get('v-s:updateCounter')[0] : 0;
        self.list[uri] = {
          subscribeCounter: 1,
          updateCounter: updateCounter,
        };
        if (action) {
          self.list[uri].action = action;
        }
        self.socket.sendMessage('+' + uri + '=' + updateCounter);
      })
  }
};

proto.unsubscribe = function (uri) {
  if ( !uri ) {
    this.list = {};
    this.socket.sendMessage('-*');
  } else if ( this.list[uri] && this.list[uri].subscribeCounter > 1) {
    --this.list[uri].subscribeCounter;
  } else {
    delete this.list[uri];
    this.socket.sendMessage('-' + uri);
  }
};

proto.restore = function () {
  this.socket.sendMessage('-*');
  for (const uri in this.list) {
    if (Object.hasOwnProperty.call(this.list, uri)) {
      this.socket.sendMessage('+' + uri + '=' + this.list[uri].updateCounter);
    }
  }
};
