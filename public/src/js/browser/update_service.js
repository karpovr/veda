// Update service for individuals that were changed on server

"use strict";

import veda from "../common/veda.js";

import IndividualModel from "../common/individual_model.js";

import Backend from "./backend.js";

export default UpdateService;

function UpdateService() {

  var self = this;

  // Singleton pattern
  if (UpdateService.prototype._singletonInstance) {
    return UpdateService.prototype._singletonInstance;
  }

  this.list = {};
  var buffer = [];
  var socketDelay = 1000;
  var socketTimeout;
  var reconnectDelayInitial = 2500 + Math.round(Math.random() * 2500); // 2.5 - 5 sec
  var reconnectDelay = reconnectDelayInitial;
  var reconnectDelayFactor = 1.1;
  var reconnectDelayLimit = 5 * 60 * 1000; // 5 min
  var lastPing = Date.now();
  var pingTimeout = 5000;
  var pingInterval;

  return UpdateService.prototype._singletonInstance = initSocket();

  function initSocket() {
    return Backend.reset_individual(veda.ticket, "cfg:ClientUpdateServicePort").then(function (ccusPortCfg) {
      var ccusPort = ccusPortCfg["rdf:value"] && ccusPortCfg["rdf:value"][0].data,
          protocol = location.protocol === "http:" ? "ws:" : "wss:",
          port = ccusPort || ( protocol === "ws:" ? 80 : 443 ),
          address = protocol + "//" + location.hostname + ":" + port + "/ccus",
          socket = new WebSocket(address);

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

  function sendMessage (msg) {
    var socket = this;
    if (msg === "=" || msg === "-*" || msg.indexOf("ccus") === 0) {
      if (socket.readyState === 1) {
        socket.send(msg);
        //console.log("client -> server:", msg);
      }
      return;
    }
    buffer.push(msg);
    if ( !socketTimeout ) {
      socketTimeout = setTimeout(function () {
        var message = buffer.join(",");
        if (socket.readyState === 1) {
          socket.send(message);
          //console.log("client -> server:", message);
        }
        buffer = [];
        socketTimeout = undefined;
      }, socketDelay);
    }
  }

  function receiveMessage(msg) {
    //console.log("server -> client:", msg);
    if (msg === "") {
      lastPing = Date.now();
      return;
    }
    var uris = msg.indexOf("=") === 0 ? msg.substr(1) : msg;
    if (uris.length === 0) {
      return;
    }
    uris = uris.split(",");
    for (var i = 0; i < uris.length; i++) {
      try {
        var tmp = uris[i].split("=");
        var uri = tmp[0];
        if ( !uri ) {
          continue;
        }
        var updateCounter = parseInt(tmp[1]);
        var individual = new IndividualModel(uri);
        if ( individual.hasValue("v-s:updateCounter", updateCounter) ) { continue; }
        if (self.list[uri]) {
          self.list[uri].updateCounter = updateCounter;
        }
        if (self.list[uri].action) {
          self.list[uri].action.call(individual, updateCounter); // Call action
        } else if (updateCounter !== 0) {
          individual.reset(); // Default action
        }
      } catch (error) {
        console.log("error: individual update service failed", error);
      }
    }
  }

  function openedHandler(event) {
    reconnectDelay = reconnectDelayInitial;
    console.log("client: websocket opened", event.target.url);
    this.sendMessage("ccus=" + veda.ticket);
    self.restore();
    veda.trigger("ccus-online");

    pingInterval = setInterval(function (that) {
      if (Date.now() - lastPing > 2 * pingTimeout) {
        console.log("client: ping missed, close socket");
        veda.trigger("ccus-offline");
        clearInterval(pingInterval);
        that.close();
        return;
      }
    }, pingTimeout, this);
  }

  function messageHandler(event) {
    var msg = event.data;
    this.receiveMessage(msg);
  }

  function errorHandler(event) {
    console.log("client: ccus error", event);
    this.close();
  }

  function closedHandler(event) {
    reconnectDelay = reconnectDelay < reconnectDelayLimit ? reconnectDelay * reconnectDelayFactor : reconnectDelayLimit ;
    console.log("client: websocket closed", event.target.url, "| re-connect in", reconnectDelay / 1000, "sec");
    setTimeout(initSocket, reconnectDelay);
    veda.trigger("ccus-offline");
    clearInterval(pingInterval);
  }

};

var proto = UpdateService.prototype;

proto.subscribe = function (uri, action) {
  var self = this;
  if ( this.list[uri] ) {
    ++this.list[uri].subscribeCounter;
  } else {
    var individual = new IndividualModel(uri);
    individual.load().then(function (individual) {
      var updateCounter = individual.hasValue("v-s:updateCounter") ? individual.get("v-s:updateCounter")[0] : 0;
      self.list[uri] = {
        subscribeCounter: 1,
        updateCounter: updateCounter
      };
      if (action) {
        self.list[uri].action = action;
      }
      self.socket.sendMessage("+" + uri + "=" + updateCounter);
    });
  }
};

proto.unsubscribe = function (uri) {
  if ( !uri ) {
    this.list = {};
    this.socket.sendMessage("-*");
  } else if ( this.list[uri] && this.list[uri].subscribeCounter > 1) {
    --this.list[uri].subscribeCounter;
  } else {
    delete this.list[uri];
    this.socket.sendMessage("-" + uri);
  }
};

proto.restore = function () {
  this.socket.sendMessage("-*");
  var subscribeMsg = [];
  for (var uri in this.list) {
    this.socket.sendMessage("+" + uri + "=" + this.list[uri].updateCounter);
  }
};
