import $ from 'jquery';

export const post = function (individual, template, container) {
  template = $(template);
  container = $(container);

  if (individual.hasValue('v-s:hasCommunicationMeanChannel', 'd:a1iwni0b54fvcz41vuts08bxqsh')) {
    template.find('div[property="v-s:description"]').remove();
    template.find('a[property="v-s:description"]').attr("href", "mailto:" + individual["v-s:description"][0]);
  } else {
    template.find('a[property="v-s:description"]').remove();
  }
};

export const html = `
<tr>
  <td about="@" data-template="v-ui:IconModalTemplate"></td>
  <td>
    <div about="@" rel="v-s:hasCommunicationMeanChannel" data-template="v-ui:LabelTemplate" class="view -edit -search"></div>
    <veda-control rel="v-s:hasCommunicationMeanChannel" data-type="link" class="-view edit search fulltext dropdown"></veda-control>
  </td>
  <td>
    <div about="@" rel="v-s:hasCommunicationMeanTarget" data-template="v-ui:LabelTemplate" class="view -edit -search"></div>
    <veda-control rel="v-s:hasCommunicationMeanTarget" data-type="link" class="-view edit search fulltext dropdown"></veda-control>
  </td>
  <td>
    <a about="@" property="v-s:description" class="view -edit -search"></a>
    <div about="@" property="v-s:description" class="view -edit -search"></div>
    <veda-control property="v-s:description" data-type="string" class="-view edit search"></veda-control>
  </td>
  <td>
    <div property="rdfs:comment" class="view -edit -search"></div>
    <veda-control property="rdfs:comment" data-type="string" class="-view edit search"></veda-control>
  </td>
</tr>
`;