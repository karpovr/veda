import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const switchBehavior = container.attr('data-switch-behavior') || 'checkbox';
  const switches = $('.btn', template);
  veda.user.preferences.on('v-ui:preferredLanguage', langHandler);
  template.one('remove', function () {
    veda.user.preferences.off('v-ui:preferredLanguage', langHandler);
  });
  langHandler();
  template.on('click', 'button.lang', toggleLanguage);
  function langHandler () {
    const preferredLanguage = veda.user.preferences['v-ui:preferredLanguage'].map(function (language) {
      return language.id;
    });
    switches.each(function () {
      const $this = $(this);
      const lang_uri = $this.attr('resource');
      if (preferredLanguage.indexOf(lang_uri) > -1) {
        $this.addClass('active btn-success').removeClass('btn-default');
      } else {
        $this.removeClass('active btn-success').addClass('btn-default');
      }
    });
  }
  function toggleLanguage (e) {
    e.stopPropagation();
    const target = $(e.target);
    const lang_uri = target.attr('resource');
    const lang = new IndividualModel(lang_uri);
    const hasLanguage = veda.user.preferences.hasValue('v-ui:preferredLanguage', lang);
    const languageCount = veda.user.preferences['v-ui:preferredLanguage'].length;
    if (!hasLanguage) {
      if (switchBehavior === 'checkbox') {
        veda.user.preferences.addValue('v-ui:preferredLanguage', lang);
      } else {
        veda.user.preferences.set('v-ui:preferredLanguage', [lang]);
      }
    } else if (hasLanguage && languageCount > 1) {
      veda.user.preferences.removeValue('v-ui:preferredLanguage', lang);
    } else {
      return;
    }
  }
};

export const html = `
  <div about="@" class="btn-group margin-sm-h" rel="rdf:value">
    <button about="@" property="rdfs:label" class="lang btn btn-xs btn-default navbar-btn"></button>
  </div>
`;
