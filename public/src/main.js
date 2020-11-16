// Main

import veda from "./js/common/veda.js";

import AppModel from "./js/common/app_model.js";

import AppPresenter from "./js/browser/app_presenter.js";

import Auth from "./js/browser/auth.js";

import "./js/browser/individual_presenter.js";

import "jquery";

import "bootstrap";

var xhr = new XMLHttpRequest();
xhr.onload = function (e) {
  var loadIndicator = document.getElementById("load-indicator");
  loadIndicator.style.display = "none";
  if (this.status == 200) {
    var manifest = JSON.parse(xhr.response);
    AppModel.call(veda, manifest);
    Auth();
    AppPresenter();
  } else {
    console.log(e);
  }
};
xhr.onerror = console.log;
xhr.ontimeout = console.log;
xhr.open("GET", "./manifest");
xhr.send();
