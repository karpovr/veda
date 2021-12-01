import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var switchBehavior = container.attr("data-switch-behavior") || "checkbox";
  var switches = $(".btn", template);
  veda.user.preferences.on("v-ui:preferredLanguage", langHandler);
  template.one("remove", function () {
    veda.user.preferences.off("v-ui:preferredLanguage", langHandler);
  });
  langHandler();
  template.on("click", "button.lang", toggleLanguage);
  function langHandler() {
    var preferredLanguage = veda.user.preferences["v-ui:preferredLanguage"].map(function (language) { return language.id; });
    switches.each(function () {
      var $this = $(this);
      var lang_uri = $this.attr("resource");
      if (preferredLanguage.indexOf(lang_uri) > -1) {
        $this.addClass("active btn-success").removeClass("btn-default");
      } else {
        $this.removeClass("active btn-success").addClass("btn-default");
      }
    });
  }
  function toggleLanguage (e) {
    e.stopPropagation();
    var target = $(e.target);
    var lang_uri = target.attr("resource");
    var lang = new IndividualModel(lang_uri);
    var lang_name = lang["rdf:value"][0].toString();
    var hasLanguage = veda.user.preferences.hasValue("v-ui:preferredLanguage", lang);
    var languageCount = veda.user.preferences["v-ui:preferredLanguage"].length;
    if ( !hasLanguage ) {
      if (switchBehavior === "checkbox") {
        veda.user.preferences.addValue("v-ui:preferredLanguage", lang);
      } else {
        veda.user.preferences.set("v-ui:preferredLanguage", [lang]);
      }
    } else if ( hasLanguage && languageCount > 1 ) {
      veda.user.preferences.removeValue("v-ui:preferredLanguage", lang);
    } else {
      return;
    }
  };
};

export const html = `
<div about="@" class="btn-group margin-sm-h" rel="rdf:value">
  <button about="@" property="rdfs:label" class="lang btn btn-xs btn-default navbar-btn"></button>
</div>
`;