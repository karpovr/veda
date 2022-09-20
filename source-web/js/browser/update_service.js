// Update service for individuals that were changed on server

import veda from '../common/veda.js';

import riot from '../common/lib/riot.js';

import Backend from '../common/backend.js';

export default UpdateService;

/**
 * Client in memory cache update service singleton constructor
 * @param {string} address - WebSocket address
 * @return {Promise} update service instance promise
 */
function UpdateService () {
  if (UpdateService.prototype._singletonInstance) {
    return UpdateService.prototype._singletonInstance;
  }

  riot.observable(this);
  this.list = {};
  this.onLine = false;

  UpdateService.prototype._singletonInstance = this;
}

const proto = UpdateService.prototype;

proto.start = async function () {
  if (this.started) {
    return Promise.resolve(this);
  }
  this.started = true;
  this.stopped = false;
  const self = this;
  const reconnectDelayInitial = 10000 + Math.floor(Math.random() * 50000); // 10 - 60 sec
  const reconnectDelayFactor = 1.25;
  const reconnectDelayLimit = 5 * 60 * 1000; // 5 min
  const pingTimeout = 10000;

  const buffer = [];
  const socketDelay = 1000;
  let socketTimeout;
  let reconnectDelay = reconnectDelayInitial;
  let lastPing = Date.now();
  let pingInterval;

  try {
    const addressCfg = await Backend.get_individual('', 'cfg:ClientUpdateServiceAddress', false);
    this.address = addressCfg['rdf:value'] && addressCfg['rdf:value'][0].data;
    this.url = new URL(this.address);
  } catch (error) {
    console.log(`CCUS address error, address = ${this.address}, url = ${this.url}`, error);
    this.url = new URL(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${this.address}`);
  }

  try {
    const socket = new WebSocket(this.url);
    socket.onopen = openedHandler;
    socket.onclose = closedHandler;
    socket.onerror = errorHandler;
    socket.onmessage = messageHandler;
    socket.receiveMessage = receiveMessage;
    socket.sendMessage = sendMessage;
    this.socket = socket;
  } catch (error) {
    this.started = false;
    reconnectDelay = reconnectDelay < reconnectDelayLimit ? reconnectDelay * reconnectDelayFactor : reconnectDelayLimit;
    console.error('Init socket failed, retry in', reconnectDelay / 1000, 'sec');
    setTimeout(this.start.bind(this), reconnectDelay);
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
      }
      return;
    }
    buffer.push(msg);
    if ( !socketTimeout ) {
      socketTimeout = setTimeout(() => {
        if (socket.readyState === 1) {
          while (buffer.length) {
            const message = buffer.splice(0, 100).join(',');
            socket.send(message);
          }
        }
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
    if (msg === '') {
      lastPing = Date.now();
      return;
    }
    let uris = msg.indexOf('=') === 0 ? msg.substr(1) : msg;
    if (uris.length === 0) {
      return;
    }
    uris = uris.split(',');
    for (const pairStr of uris) {
      try {
        const pair = pairStr.split('=');
        const uri = pair[0];
        if ( !uri ) {
          continue;
        }
        const updateCounter = parseInt(pair[1]);
        if (self.list[uri]) {
          self.list[uri].updateCounter = updateCounter;
        }
        if (self.list[uri] && typeof self.list[uri].callback === 'function') {
          self.list[uri].callback(updateCounter);
        }
      } catch (error) {
        console.error('Individual update service failed');
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
    self.onLine = true;
    self.trigger('online');

    pingInterval = setInterval(() => {
      if (Date.now() - lastPing > 2 * pingTimeout) {
        console.log('client: ping missed, close socket');
        self.onLine = false;
        self.trigger('offline');
        clearInterval(pingInterval);
        this.close();
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
    console.error('CCUS failed', event);
    this.close();
  }

  /**
   * Socket closed handler
   * @param {Event} event
   * @return {void}
   */
  function closedHandler (event) {
    console.log('client: websocket closed', event.target.url);
    self.socket = null;
    self.onLine = false;
    self.started = false;
    self.trigger('offline');
    clearInterval(pingInterval);
    if (!self.stopped) {
      reconnectDelay = reconnectDelay < reconnectDelayLimit ? reconnectDelay * reconnectDelayFactor : reconnectDelayLimit;
      console.log('client: re-connect in', reconnectDelay / 1000, 'sec');
      setTimeout(self.start.bind(self), reconnectDelay);
    }
  }
};

proto.stop = function () {
  this.stopped = true;
  this.socket.close();
};

proto.subscribe = function (uri, updateCounter = 0, callback) {
  this.list[uri] = {updateCounter, callback};
  if (this.socket) {
    this.socket.sendMessage('+' + uri + '=' + updateCounter);
  }
};

proto.unsubscribe = function (uri) {
  if ( !uri ) {
    this.list = {};
    this.socket.sendMessage('-*');
  } else {
    delete this.list[uri];
    if (this.socket) {
      this.socket.sendMessage('-' + uri);
    }
  }
};

proto.restore = function () {
  this.socket.sendMessage('-*');
  for (const uri in this.list) {
    if (Object.hasOwnProperty.call(this.list, uri)) {
      if (this.socket) {
        this.socket.sendMessage('+' + uri + '=' + this.list[uri].updateCounter);
      }
    }
  }
};
