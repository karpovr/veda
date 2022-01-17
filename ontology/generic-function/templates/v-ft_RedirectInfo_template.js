import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue('v-wf:to')) {
    template.empty();
  }
};

export const html = `
  <div>
    <hr class="no-margin" />
    <strong><small about="v-s:TaskIsRedirectedFrom" property="rdfs:label"></small></strong>
    <small about="@" rel="v-wf:to" data-template="v-ui:LabelTemplate"></small>
  </div>
`;
