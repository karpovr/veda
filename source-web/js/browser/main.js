// Main

import veda from "../common/veda.js";

import AppModel from "../common/app_model.js";

import AppPresenter from "../browser/app_presenter.js";

import Auth from "../browser/auth.js";

import "../browser/individual_presenter.js";

export default veda;

System.import("jquery").then(function () {

  System.import("bootstrap").then(function () {

    const xhr = new XMLHttpRequest();
    xhr.onload = function (e) {
      const loadIndicator = document.getElementById("load-indicator");
      loadIndicator.style.display = "none";
      if (this.status == 200) {
        const manifest = JSON.parse(xhr.response);
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
