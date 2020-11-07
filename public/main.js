// Main

import veda from "./js/common/veda";

import AppModel from "./js/common/app_model";

import AppPresenter from "./js/browser/app_presenter";

import Auth from "./js/browser/auth";

import "./js/browser/individual_presenter";

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
