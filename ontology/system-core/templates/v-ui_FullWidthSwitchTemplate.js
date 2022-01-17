import CommonUtil from '/js/common/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  template.click(function () {
    try {
      const value = veda.user.preferences['v-ui:fullWidth'][0];
      veda.user.preferences['v-ui:fullWidth'] = [!value];
      veda.user.preferences.save();
    } catch (error) {
      console.log('Full width switch error', error);
    }
  });
  veda.user.preferences.on('v-ui:fullWidth', widthHandler);
  template.one('remove', function () {
    veda.user.preferences.off('v-ui:fullWidth', widthHandler);
  });
  widthHandler();
  function widthHandler () {
    const style = $('#full-width-style', template);
    if (veda.user.preferences.hasValue('v-ui:fullWidth', true)) {
      style.attr('media', 'all');
      template.removeClass('btn-default').addClass('btn-success active');
    } else {
      style.attr('media', 'not all');
      template.addClass('btn-default').removeClass('btn-success active');
    }
  }
  return new IndividualModel('v-s:ChangeSizeBundle').load().then(function (changeSizeBundle) {
    template.tooltip({
      container: template,
      placement: 'bottom',
      trigger: 'hover',
      title: changeSizeBundle['rdfs:label'].map(CommonUtil.formatValue).join(' '),
    });
  });
};

export const html = `
  <button class="btn btn-xs btn-default navbar-btn margin-sm-h">
    <span class="glyphicon glyphicon-fullscreen"></span>
    <style id="full-width-style" media="not all">
      .container {
        width: 98% !important;
        margin-left: 1% !important;
        margin-right: 1% !important;
      }
    </style>
  </button>
`;
