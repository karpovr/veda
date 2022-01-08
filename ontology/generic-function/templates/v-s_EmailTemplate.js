import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  template.on('validate', function () {
    var result = {};
    var promises = individual['v-s:attachment'].map(function (attach) {
      return attach.getPropertyChain('v-s:fileSize');
    });
    return Promise.all(promises).then(function (fileSizeArr) {
      var fileSizeSUM = 0;
      fileSizeArr.forEach(function (fileSize) {
        fileSizeSUM += +fileSize;
      });
      console.log(fileSizeSUM > 15728640); //15 мб
      if (fileSizeSUM > 15728640)
        result['v-s:attachment'] = {
          state: false,
          cause: ['v-s:attachmentEmailBundle'],
        };
      template[0].dispatchEvent(new CustomEvent('validated', { detail: result }));
    });
  });
};

export const html = `
  <div class="container sheet">
    <h2>
      <span about="v-s:Email" property="rdfs:label"></span><br />
      <small about="@" property="rdfs:label"></small>
    </h2>
    <hr class="view edit -search" />
    <div class="row">
      <div class="col-sm-6">
        <em about="v-wf:from" property="rdfs:label"></em>
        <div about="@" property="v-wf:from" class="-view edit -search"></div>
        <div property="v-wf:from" class="view -edit search"></div>
        <veda-control data-type="string" property="v-wf:from" class="-view -edit search"></veda-control>
        <em about="v-wf:to" property="rdfs:label"></em>
        <div about="@" property="v-wf:to" class="-view edit -search"></div>
        <div property="v-wf:to" class="view -edit search"></div>
        <veda-control data-type="string" property="v-wf:to" class="-view -edit search"></veda-control>
        <em about="v-s:senderMailbox" property="rdfs:label"></em>
        <div about="@" property="v-s:senderMailbox" class="-view edit -search"></div>
        <div property="v-s:senderMailbox" class="view -edit search"></div>
        <veda-control data-type="string" property="v-s:senderMailbox" class="-view -edit search"></veda-control>
        <em about="v-s:recipientMailbox" property="rdfs:label"></em>
        <div property="v-s:recipientMailbox" class="view edit -search"></div>
        <veda-control data-type="generic" property="v-s:recipientMailbox" class="-view edit search"></veda-control>
        <em about="v-s:subject" property="rdfs:label"></em>
        <div property="v-s:subject" class="view -edit -search"></div>
        <veda-control data-type="string" property="v-s:subject" class="-view edit search"></veda-control>
        <em about="v-s:messageBody" property="rdfs:label"></em>
        <div property="v-s:messageBody" class="view -edit -search"></div>
        <veda-control property="v-s:messageBody" data-type="text" rows="4" class="-view edit search"></veda-control>
        <em about="v-s:attachment" property="rdfs:label"></em>
        <div rel="v-s:attachment" data-template="v-ui:FileTemplateWithComment" data-embedded="true"></div>
        <veda-control data-type="file" rel="v-s:attachment" class="-view edit -search create"></veda-control>
        <br />
      </div>
    </div>
    <hr />
    <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
    <br />
    <div class="actions">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="save edit cancel delete"></span>
    </div>
  </div>
`;
