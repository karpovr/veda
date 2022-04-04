// Update service for individuals that were changed on server

import veda from '../common/veda.js';

import IndividualModel from '../common/individual_model.js';

import riot from '../common/lib/riot.js';

import Backend from '../common/backend.js';

export default UpdateService;

/**
 * Client in memory cache update service singleton constructor
 * @return {Promise} update service instance promise
 */
function UpdateService () {
  // Singleton pattern
  if (UpdateService.prototype._singletonInstance) {
    return UpdateService.prototype._singletonInstance;
  }

  const self = riot.observable(this);
  self.list = {};
  self.onLine = false;

  UpdateService.prototype._singletonInstance = this;
}

const proto = UpdateService.prototype;

proto.init = function () {
  if (this.inited) {
    return Promise.resolve(this);
  }
  this.inited = true;
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

  return Backend.get_individual('', 'cfg:ClientUpdateServiceAddress', false)
    .then((addressCfg) => {
      const address = addressCfg['rdf:value'] && addressCfg['rdf:value'][0].data;
      const socket = new WebSocket(address);

      socket.onopen = openedHandler;
      socket.onclose = closedHandler;
      socket.onerror = errorHandler;
      socket.onmessage = messageHandler;
      socket.receiveMessage = receiveMessage;
      socket.sendMessage = sendMessage;
      self.socket = socket;
      return self;
    })
    .catch((error) => {
      this.inited = false;
      reconnectDelay = reconnectDelay < reconnectDelayLimit ? reconnectDelay * reconnectDelayFactor : reconnectDelayLimit;
      console.log('init socket error, retry in', reconnectDelay / 1000, 'sec');
      setTimeout(self.init.bind(self), reconnectDelay);
    });

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
        console.error('error: individual update service failed');
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
    setTimeout(self.init.bind(self), reconnectDelay);
    self.onLine = false;
    self.inited = false;
    self.trigger('offline');
    clearInterval(pingInterval);
  }
};

proto.subscribe = function (uri, action) {
  if ( this.list[uri] ) {
    ++this.list[uri].subscribeCounter;
  } else {
    const individual = new IndividualModel(uri);
    if (individual.isNew()) {
      const updateCounter = 0;
      this.list[uri] = {
        subscribeCounter: 1,
        updateCounter: updateCounter,
      };
      if (action) {
        this.list[uri].action = action;
      }
      if (this.socket) {
        this.socket.sendMessage('+' + uri + '=' + updateCounter);
      }
    } else {
      individual.one('afterLoad', () => {
        const updateCounter = individual.hasValue('v-s:updateCounter') ? individual.get('v-s:updateCounter')[0] : 0;
        this.list[uri] = {
          subscribeCounter: 1,
          updateCounter: updateCounter,
        };
        if (action) {
          this.list[uri].action = action;
        }
        if (this.socket) {
          this.socket.sendMessage('+' + uri + '=' + updateCounter);
        }
      });
    }
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
