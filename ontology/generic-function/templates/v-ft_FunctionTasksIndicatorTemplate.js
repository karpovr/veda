import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';
import Util from '/js/common/util.js';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  /*var counter_uri = "d:taskCounter_" + veda.user.id.split(":").join("_");
  $("#counter", template).attr("about", counter_uri);*/
  return new IndividualModel("v-s:TaskBundle").load().then(function(taskBundle) {
    template.tooltip({
      container: template,
      placement: "bottom",
      trigger: "hover",
      title: taskBundle["rdfs:label"].map(Util.formatValue).join(" ")
    });
  });
};

export const html = `
<a href="#/@" data-toggle="tooltip" data-trigger="hover" data-placement="bottom">
  <span class="fa fa-envelope-o fa-lg"></span>
  <!--span id="counter" class="label label-danger" property="v-ft:inboxCount"></span-->
</a>
`;