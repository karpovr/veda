import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  //email
  if (individual.hasValue("v-s:hasCommunicationMeanChannel", "d:a1iwni0b54fvcz41vuts08bxqsh")) {
    $(".simple-text", template).remove();
    var mailto = individual["v-s:description"][0];
    $("a.email-link", template).attr("href", "mailto:"+mailto);
  } else {
    $("a.email-link", template).remove();
  }
};

export const html = `
<div>
  <strong about="@" rel="v-s:hasCommunicationMeanChannel">
    <span about="@" property="v-s:shortLabel"></span>
  </strong>
  <span class="simple-text" about="@" property="v-s:description"></span>
  <a class="email-link" style="cursor: pointer;"><span about="@" property="v-s:description"></span></a>
</div>
`;