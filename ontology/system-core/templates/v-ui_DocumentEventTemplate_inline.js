import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if ( individual.hasValue("v-wf:hasStartForm") ) {
    var startForm = individual["v-wf:hasStartForm"][0];
    $("[about='start-form']", template).attr("about", startForm.id);
  } else { // Проверим наличие переменной стартовой формы
    var inVars = individual["v-wf:inVars"].map(function (inVar) {
      return inVar.load();
    });
    if (inVars.length) {
      return Promise.all(inVars).then(function (inVars) {
        var startFormVar = inVars.filter(function (inVar) {
          return inVar.hasValue("v-wf:variableName",  "startForm_id");
        });
        var startForm = startFormVar[0]["v-wf:variableValue"][0];
        $("[about='start-form']", template).attr("about", startForm.id);
      }).catch(function () {
        $("[about='start-form']", template).remove();
      });
    } else {
      $("[about='start-form']", template).remove();
    }
  }
};

export const html = `
<div>
  <a about="@" class="process-id" href="#/@" rel="v-wf:instanceOf" data-template="v-ui:LabelTemplate"></a>
  <a href="#" class="stop-process glyphicon glyphicon-remove text-danger" style="display:none;"></a>
  <span class="process-stopped glyphicon glyphicon-minus-sign text-danger" style="display:none;"></span>
  <span about="start-form">
    <span>
      &nbsp;&nbsp;(<a href="#/@" about="@" rel="rdf:type" data-template="v-ui:LabelTemplate"></a>)
    </span>
  </span>
</div>
`;