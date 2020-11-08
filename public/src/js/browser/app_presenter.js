// Veda application presenter

"use strict";

import veda from "../common/veda.js";

import riot from "../common/lib/riot.js";

import IndividualModel from "../common/individual_model.js";

import Notify from "../browser/notify.js";

import Util from "../common/util.js";

export default function AppPresenter() {

  // View resource using special templates:
  // "v-ui:ttl" on Ctrl + Alt + Click
  // "v-ui:json" on Alt + Shift + Click
  // "v-ui:generic" on Ctrl + Alt + Shift + Click
  $("body").on("click", "[resource], [about]", function (e) {
    var uri = $(this).attr("resource") || $(this).attr("about");
    var hash = "#/" + uri;
    if (e.altKey && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      setTimeout(function () {
        riot.route(hash +  "//v-ui:generic");
      });
    } else if (e.altKey && e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      setTimeout(function () {
        riot.route(hash +  "//v-ui:ttl");
      });
    } else if (e.altKey && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      setTimeout(function () {
        riot.route(hash +  "//v-ui:json");
      });
    }
  });
  // Outline resource containers to switch view to special templates
  var outlined = [];
  $(document)
    .on("keydown", function (e) {
      if (e.altKey && e.shiftKey || e.altKey && e.ctrlKey || e.altKey && e.ctrlKey && e.shiftKey) {
        $("body").on("mouseover", "[resource], [about]", outline);
      }
    })
    .on("keyup", removeOutline);
  function outline(e) {
    if (e.altKey && e.shiftKey || e.altKey && e.ctrlKey || e.altKey && e.ctrlKey && e.shiftKey) {
      e.stopPropagation();
      outlined.forEach(function (item) { item.removeAttr("title").removeClass("gray-outline") });
      var $this = $(this);
      $this.addClass("gray-outline").attr("title", $this.attr("resource") || $this.attr("about"));
      outlined = [ $this ];
    } else {
      removeOutline(e);
    }
  }
  function removeOutline(e) {
    $("body").off("mouseover", outline);
    outlined.forEach(function (item) { item.removeAttr("title").removeClass("gray-outline") });
    outlined = [];
  }

  // Localize resources on language change
  veda.on("language:changed", function () {
    var resourcesNodes = $("[resource], [about]");
    var resources = resourcesNodes.map(function () {
      var $this = $(this);
      return $this.attr("about") || $this.attr("resource");
    }).get();
    resources = Util.unique(resources);
    resources.forEach(function (resource_uri) {
      var resource = new IndividualModel(resource_uri);
      for (var property_uri in resource.properties) {
        if (property_uri === "@") { continue; }
        if ( resource.properties[property_uri] && resource.properties[property_uri].length && resource.properties[property_uri][0].type === "String" ) {
          resource.trigger("propertyModified", property_uri, resource.get(property_uri));
          resource.trigger(property_uri, resource.get(property_uri));
        }
      }
    });
  });

  // Prevent empty links routing
  $("body").on("click", "[href='']", function (e) {
    e.preventDefault();
  });

  // Route on link click (IE mandatory!)
  $("body").on("click", "[href^='#/']", function (e) {
    e.preventDefault();
    var hash = $(this).attr("href");
    return ( hash === location.hash ? false : riot.route(hash) );
  });

  var routerInstalled;

  function installRouter (main) {

    if (routerInstalled) { return; }

    routerInstalled = true;

    // Router function
    riot.route( function (hash) {
      $("#load-indicator").show();
      if (typeof hash === "string") {
        var hash_index = hash.indexOf("#");
        if (hash_index >= 0) {
          hash = hash.substring(hash_index);
        } else {
          $("#main").empty();
          return main.present("#main").then(function () {
            $("#load-indicator").hide();
          });
        }
      } else {
        $("#main").empty();
        return main.present("#main").then(function () {
          $("#load-indicator").hide();
        });
      }
      var tokens = decodeURI(hash).slice(2).split("/"),
          uri = tokens[0],
          container = tokens[1] || "#main",
          template = tokens[2],
          mode = tokens[3],
          extra = tokens[4];
      if (extra) {
        extra = extra.split("&").reduce(function (acc, pair) {
          var split = pair.split("="),
              name  = split[0] || "",
              values = split[1].split("|") || "";
          acc[name] = acc[name] || [];
          values.forEach(function (value) {
            acc[name].push( parse(value) );
          });
          return acc;
        }, {});
      }

      if (uri) {
        var individual = new IndividualModel(uri);
        $(container).empty();
        individual.present(container, template, mode, extra).then(function () {
          $("#load-indicator").hide();
          if ( !individual.scroll ) {
            window.scrollTo(0, 0);
          }
        });
      } else {
        $("#main").empty();
        main.present("#main").then(function () {
          $("#load-indicator").hide();
        });
      }
    });
  }

  // Triggered in auth
  veda.on("started", function () {
    $("#load-indicator").show();
    var layout_uri = veda.manifest.veda_layout;
    var main_uri = veda.manifest.veda_main;
    var start_url = veda.manifest.start_url;
    $("#app").empty();
    if (layout_uri && main_uri && start_url) {
      var layout = new IndividualModel(layout_uri);
      layout.present("#app")
        .then(function () {
          var main = new IndividualModel(main_uri);
          return main.load();
        })
        .then(installRouter)
        .then(function () {
          riot.route(location.hash || start_url);
        });
    } else {
      console.log("Incomplete layout params in manifest");
      var layout_param_uri = veda.user.hasValue("v-s:origin", "ExternalUser") ? "cfg:LayoutExternal" : "cfg:Layout" ;
      var layout_param = new IndividualModel( layout_param_uri );
      var main_param_uri = veda.user.hasValue("v-s:origin", "ExternalUser") ? "cfg:MainExternal" : "cfg:Main" ;
      var main_param = new IndividualModel( main_param_uri );
      layout_param.load()
      .then(function (layout_param) {
        return layout_param["rdf:value"][0].load();
      })
      .then(function (layout) {
        return layout.present("#app");
      })
      .then(function () {
        return main_param.load();
      })
      .then(function (main_param) {
        return main_param["rdf:value"][0].load();
      })
      .then(installRouter)
      .catch( function (error) {
        var notify = new Notify();
        notify("danger", error);
      })
      .then(function () {
        riot.route(location.hash);
      });
    }
  });
  function parse (value) {
    if ( !isNaN( value.split(" ").join("").split(",").join(".") ) ) {
      return parseFloat( value.split(" ").join("").split(",").join(".") );
    } else if ( !isNaN( Date.parse(value) ) ) {
      return new Date(value);
    } else if ( value === "true" ) {
      return true;
    } else if ( value === "false" ) {
      return false;
    } else {
      var individ = new IndividualModel(value);
      if ( individ.isSync() && !individ.isNew() ) { return individ; }
    }
    return value || null;
  }


  if (typeof localStorage !== "undefined" && localStorage !== null) {
    // Listen to client notifications
    veda.on("started", function () {
      var clientNotification = new IndividualModel("cfg:ClientNotification");
      clientNotification.load().then(function (clientNotification) {
        clientNotification.on("afterReset", checkNotification);
        checkNotification.call(clientNotification);
      });
      function checkNotification() {
        var clientNotification = this;
        var browserNotificationList;
        try {
          browserNotificationList = JSON.parse(localStorage.clientNotification);
        } catch (error) {
          browserNotificationList = [];
        }
        var serverNotificationList = clientNotification.get("rdf:value").map(function (item) { return item.id; });
        if ( !Util.areEqual(browserNotificationList, serverNotificationList) && serverNotificationList.length ) {
          serverNotificationList.reduce(function (p, notification_uri, i) {
            return p.then(function () {
              if (browserNotificationList.indexOf(notification_uri) >= 0) { return; }
              var notification = new IndividualModel(notification_uri);
              return notification.load().then(function (notification) {
                return (notification.properties["v-s:newsAudience"] || []).map(function (audience) {
                  return audience.data;
                });
              }).then(function (audience) {
                audience = audience.sort();
                return veda.user.memberOf().then(function (memberOf) {
                  memberOf = memberOf.sort();
                  var i = 0, j = 0, audience_uri, memberOf_uri;
                  while( (audience_uri = audience[i]) && (memberOf_uri = memberOf[j]) ) {
                    if (memberOf_uri < audience_uri) {
                      j++;
                    } else if (memberOf_uri > audience_uri) {
                      i++;
                    } else {
                      return Util.confirm(notification).then(function (confirmed) {
                        if ( confirmed ) {
                          localStorage.clientNotification = JSON.stringify(serverNotificationList);
                          if (notification.hasValue("v-s:script")) {
                            var script = notification.get("v-s:script")[0].toString();
                            return eval(script);
                          }
                        }
                      });
                    }
                  }
                });
              });
            }).catch(console.log);
          }, Promise.resolve());
        } else {
          localStorage.clientNotification = JSON.stringify(serverNotificationList);
        }
      }

    });
  }

  // On/off-line status indicator
  function statusHandler(status) {
    var lineStatus = document.getElementById("line-status");
    lineStatus.style.display = "block";
    lineStatus.classList.remove("online");
    lineStatus.classList.remove("limited");
    lineStatus.classList.remove("offline");
    lineStatus.classList.add(status);
  }
  veda.on("status", statusHandler);

  // Service worker
  if ("serviceWorker" in navigator) {

    // Install SW
    navigator.serviceWorker.register("/sw-simple.js", { scope: window.location.pathname }).then(function(worker) {
      console.log("Service worker registered:", worker.scope);
    }).catch(function(error) {
      console.log("Registration failed with " + error);
    });

    // Install application prompt
    var showAddToHomeScreen = function () {
      var installApp = document.getElementById("install-app");
      var installBtn = document.getElementById("install-btn");
      var rejectInstallBtn = document.getElementById("reject-install-btn");
      installApp.style.display = "block";
      installBtn.addEventListener("click", addToHomeScreen);
      rejectInstallBtn.addEventListener("click", rejectInstall);
    }
    var addToHomeScreen = function () {
      var installApp = document.getElementById("install-app");
      installApp.style.display = "none";  // Hide the prompt
      deferredPrompt.prompt();  // Wait for the user to respond to the prompt
      deferredPrompt.userChoice
        .then(function(choiceResult) {
          if (choiceResult.outcome === "accepted") {
            console.log("User accepted install prompt");
          } else {
            console.log("User dismissed install prompt");
          }
          deferredPrompt = null;
        });
    }
    var rejectInstall = function () {
      var installApp = document.getElementById("install-app");
      installApp.style.display = "none";
      localStorage.rejectedInstall = true;
    }
    var deferredPrompt;
    window.addEventListener("beforeinstallprompt", function (e) {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      deferredPrompt = e;
      if ( !localStorage.rejectedInstall ) {
        showAddToHomeScreen();
      }
    });
  }

}
