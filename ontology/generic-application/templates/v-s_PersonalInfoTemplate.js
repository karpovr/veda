export const html = `
<div class="sheet" style="display: flex; flex-flow: column; width: 100%">
  <h3 class="no-margin"><span about="@" property="v-s:lastName"></span> <span about="@" property="v-s:firstName"></span> <span about="@" property="v-s:middleName"></span></h3>
  <veda-control property="v-s:lastName" data-type="multilingualString" class="-view edit search"></veda-control>
  <veda-control property="v-s:firstName" data-type="multilingualString" class="-view edit search"></veda-control>
  <veda-control property="v-s:middleName" data-type="multilingualString" class="-view edit search"></veda-control>
  <br/>
  <div class="form-inline">
    <div class="form-group">
      <label about="v-s:birthday" property="rdfs:label"></label>:
      <span class="view -edit -search" about="@" property="v-s:birthday"></span>
      <veda-control property="v-s:birthday" data-type="date" class="-view edit search"></veda-control>
    </div>
  </div>
  <br/>
  <div class="form-inline">
    <div class="form-group">
      <label about="v-s:occupation" property="rdfs:label"></label>:
      <span about="@" rel="v-s:defaultAppointment">
        <span>
          <span about="@" rel="v-s:occupation" data-template="v-ui:LabelTemplate"></span>,
          <span about="@" rel="v-s:parentUnit" data-template="v-ui:LabelTemplate"></span>
        </span>
    </div>
  </div>
  <br/>
  <div class="form-inline">
    <div class="form-group">
      <label about="v-s:phone" property="rdfs:label"></label>:
      <span class="view -edit -search" about="@" rel="v-s:hasAccount" data-embedded="true">
        <span class="view -edit -search" about="@" property="v-s:phone"></span>
      </span>
      <veda-control property="v-s:phone" data-type="string" class="-view edit search"></veda-control>
    </div>
  </div>
  <br/>
  <div class="form-inline">
    <div class="form-group">
      <label about="v-s:mailbox" property="rdfs:label"></label>:
      <span about="@" rel="v-s:hasAccount" data-embedded="true" data-template="v-s:PersonalInfoTemplate_mailbox"></span>
    </div>
  </div>
  <br/>
  <div class="form-inline">
    <div class="form-group">
      <label about="v-s:login" property="rdfs:label"></label>:
      <span about="@" rel="v-s:hasAccount">
        <span about="@" property="v-s:login"></span>
      </span>
    </div>
  </div>
</div>
`;
