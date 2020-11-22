import veda from "../common/veda.js";

//import AppModel from "../common/app_model.js";

//import "../common/backend.js";

import "../server/codelets.js";

import "../server/docflow.js";

import "../server/docflow-util.js";

//import "../server/numerator.js";

import "../server/util.js";

veda.env = "server";

veda.ticket = get_env_str_var('$ticket');

//AppModel.call(veda);

//veda.init("cfg:VedaSystem");

//console.log("user:", veda.user.id, "| ticket:", veda.ticket);

console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

export default veda;
