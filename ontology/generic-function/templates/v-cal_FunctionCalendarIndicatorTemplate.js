import CommonUtil from '/js/common/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  /*var counter_uri = "d:taskCounter_" + veda.user.id.split(":").join("_");
  $(".label", template).attr("about", counter_uri);*/
  template.tooltip({
    container: template,
    placement: "bottom",
    trigger: "hover",
    title: individual["rdfs:label"].map(CommonUtil.formatValue).join(" ")
  });
};

export const html = `
<a href="#/@" data-toggle="tooltip" data-trigger="hover" data-placement="bottom">
  <span class="fa fa-calendar fa-lg"></span>
  <!--span id="counter" class="label label-danger" property="v-ft:inboxWeekCount"></span-->
</a>
`;