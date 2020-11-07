import riot from "./lib/riot";

import AppModel from "./app_model";

export default riot.observable(function Module(arg) {

  // Module(fn) --> add a new module
  if (typeof arg === "function") {

    if (Module.ready) {
      arg(veda);
    } else {
      Module.on("ready", arg);
    }

  // Module(conf) --> initialize the application
  } else {

    var veda = AppModel.call({}, arg);

    Module.trigger("ready", veda);

  }

});
