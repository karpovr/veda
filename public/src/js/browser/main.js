// Main

import veda from "../common/veda.js";

import AppModel from "../common/app_model.js";

import AppPresenter from "../browser/app_presenter.js";

import Auth from "../browser/auth.js";

import "../browser/individual_presenter.js";

veda.env = "browser";

System.import("jquery").then(function () {

  System.import("bootstrap").then(function () {

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

  });

});
