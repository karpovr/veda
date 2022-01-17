export const html = `
  <div class="container sheet">
    <h3 class="margin-sm">
      <span about="v-s:CurrencyExchangeRate" property="rdfs:label"></span>
      <small about="@" property="rdfs:label"></small>
    </h3>
    <hr />
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5"></div>
      <div class="col-sm-9 col-xs-7">
        <div class="checkbox no-margin">
          <label>
            <veda-control property="v-s:valid" data-type="boolean"></veda-control>
            <span about="v-s:valid" property="rdfs:label"></span>
          </label>
        </div>
      </div>
    </div>
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5">
        <label about="v-s:date" property="rdfs:label"></label>
      </div>
      <div class="col-sm-3 col-xs-3">
        <div property="v-s:date" class="view -edit search"></div>
        <veda-control data-type="date" property="v-s:date" class="-view edit search"></veda-control>
      </div>
    </div>
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5">
        <label about="v-s:hasCurrencyExchangeRatePurpose" property="rdfs:label"></label>
      </div>
      <div class="col-sm-9 col-xs-7">
        <div rel="v-s:hasCurrencyExchangeRatePurpose" data-template="v-ui:LabelTemplate" class="view -edit search"></div>
        <veda-control data-type="link" rel="v-s:hasCurrencyExchangeRatePurpose" class="-view edit search fulltext dropdown"></veda-control>
      </div>
    </div>
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5"></div>
      <div class="col-sm-9 col-xs-7">
        <table class="table table-striped table-bordered">
          <tr>
            <th width="5%"></th>
            <th width="30%" about="v-s:hasCurrency" property="rdfs:label"></th>
            <th width="5%"></th>
            <th width="25%" about="v-s:rate" property="rdfs:label"></th>
            <th width="30%" about="v-s:hasCurrency" property="rdfs:label"></th>
          </tr>
          <tr>
            <td>
              <div class="col-md-4">
                <strong>1</strong>
              </div>
            </td>
            <td>
              <div rel="v-s:hasCurrencySource" data-template="v-ui:LabelTemplate" class="view -edit -search"></div>
              <veda-control data-type="link" rel="v-s:hasCurrencySource" class="-view edit search fulltext dropdown"></veda-control>
            </td>
            <td>
              <div class="col-md-4">
                <strong>=</strong>
              </div>
            </td>
            <td>
              <div property="v-s:rate" class="view -edit search"></div>
              <veda-control data-type="decimal" property="v-s:rate" class="-view edit search"></veda-control>
            </td>
            <td>
              <div rel="v-s:hasCurrencyTarget" data-template="v-ui:LabelTemplate" class="view -edit -search"></div>
              <veda-control data-type="link" rel="v-s:hasCurrencyTarget" class="-view edit search fulltext dropdown"></veda-control>
            </td>
          </tr>
        </table>
      </div>
    </div>
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5">
        <label about="v-s:Comment" property="rdfs:label"></label>
      </div>
      <div class="col-sm-9 col-xs-7">
        <div property="v-s:Comment" class="view -edit -search"></div>
        <veda-control data-type="string" property="v-s:Comment" class="-view edit search"></veda-control>
      </div>
    </div>
    <hr />
    <!-- BUTTONS -->
    <div class="actions view edit -search">
      <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="edit save cancel"></span>
    </div>
  </div>
`;
