import $ from 'jquery';
import veda from '/js/common/veda.js';
import Backend from '/js/common/backend.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  template.on("validate", function () {
    var result = {};
    if (!individual.hasValue('v-s:login')) {
      result["v-s:login"] = {
        state: false,
        cause: ["v-ui:minCardinality"]
      };
    }
    if (!individual.hasValue('v-s:mailbox')) {
      result["v-s:mailbox"] = {
        state: false,
        cause: ["v-ui:minCardinality"]
      };
    }
    if (!individual.hasValue('v-s:origin')) {
      result["v-s:origin"] = {
        state: false,
        cause: ["v-ui:minCardinality"]
      };
    }
    if (!individual.hasValue('v-s:authOrigin')) {
      result["v-s:authOrigin"] = {
        state: false,
        cause: ["v-ui:minCardinality"]
      };
    }

    if( individual.hasValue('v-s:login'))  {
      var queryString = "'rdf:type'==='v-s:Account'" + " && 'v-s:login'=='" + individual['v-s:login'][0] + "'";
      Backend.query(veda.ticket, queryString).then(function (queryResult) {
        var tmp = queryResult.result;
        if (tmp.length == 0) {
          $('#warningAccount').addClass('hide');
        } else {
          $('#warningAccount').removeClass('hide');
        }
      });
    }
    template[0].dispatchEvent(new CustomEvent("validated", {detail: result}));
  });
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  //Блок только для админа
    if (!individual.isNew() && veda.appointment.id != 'cfg:AdministratorAppointment') {
      $('.notEditForUsers').addClass('hide');
      $('#notNewBundle').removeClass('hide');
      $('.new').addClass('hide');
    }


    function autoID() {
      if (individual.isNew()) {
        var person_id = individual["v-s:backwardTarget"][0].id;
        individual.id = person_id + "_account";
        individual.trigger("idChanged");
      }
    }
    $("#recalculate", template).click(autoID);

  if(mode === "edit" && individual.isNew()){
    individual["v-s:authOrigin"]=["veda"];
  }
};

export const html = `
<div>
  <div class="container sheet">
    <div id="warningAccount" class="alert alert-warning hide">
      <span>Внимание. Аккаунтс таким логином уже существует!!!</span>
    </div>
    <h2>
      <span about="v-s:Account" property="rdfs:label"></span>
      <small about="@" property="rdfs:label"></small>
    </h2>
    <hr>
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5">
        <label about="rdfs:label" property="rdfs:label"></label>
      </div>
      <div class="col-sm-9 col-xs-7">
        <div property="rdfs:label" class="view -edit -search"></div>
        <veda-control data-type="multilingualString" property="rdfs:label" class="-view edit search"></veda-control>
      </div>
    </div>
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5">
        <label about="v-s:login" property="rdfs:label"></label>
      </div>
      <div class="col-sm-9 col-xs-7">
        <div property="v-s:login" class="view -edit -search"></div>
        <veda-control data-type="string" property="v-s:login" class="-view edit search"></veda-control>
      </div>
    </div>
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5">
        <label about="v-s:mailbox" property="rdfs:label"></label>
      </div>
      <div class="col-sm-9 col-xs-7">
        <div property="v-s:mailbox" class="view -edit -search"></div>
        <veda-control data-type="string" property="v-s:mailbox" class="-view edit search"></veda-control>
      </div>
    </div>
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5">
        <label about="v-s:origin" property="rdfs:label"></label>
      </div>
      <div class="col-sm-9 col-xs-7">
        <div property="v-s:origin" class="view -edit -search"></div>
        <veda-control data-type="string" property="v-s:origin" class="-view edit search"></veda-control>
      </div>
    </div>
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5">
        <label about="v-s:authOrigin" property="rdfs:label"></label>
      </div>
      <div class="col-sm-9 col-xs-7">
        <div property="v-s:authOrigin" class="view -edit -search"></div>
        <veda-control data-type="string" property="v-s:authOrigin" class="-view edit search"></veda-control>
      </div>
    </div>
    <div class="row row-attribute notEditForUsers">
      <div class="col-sm-3 col-xs-5">
      </div>
      <div class="col-sm-8 col-xs-6">
        <veda-control rel="@" data-type="uri" class="-view edit -search"></veda-control>
      </div>
      <div class="col-sm-1 col-xs-1 -view edit -search">
        <button id="recalculate" class="btn btn-xs btn-success">
          <span class="glyphicon glyphicon-refresh"></span>
        </button>
      </div>
    </div>
    <hr>
    <!--Системные свойства-->
    <div about="@" data-template="v-ui:SystemPropertiesTemplate" data-embedded="true"></div>
    <br>
    <!-- BUTTONS -->
    <div class="actions view edit -search">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel delete"></span>
    </div>
  </div>
</div>
`;