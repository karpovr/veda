// Application instance

import riot from "../common/lib/riot.js";

var veda = riot.observable({
  env: typeof window === "undefined" ? "server" : "browser"
});

export default veda;
