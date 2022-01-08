export const html = `
  <div class="sheet" style="display: flex; flex-flow: column; width: 100%">
    <style>
      .app-fn > .fn-icon {
        width: 0.2%;
      }
      .app-fn > .fn-name {
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    </style>
    <a
      class="margin-xl"
      href="#/@"
      about="@"
      rel="v-s:hasIcon"
      data-template="v-ui:ImageTemplate"
      style="width:55%; margin-left: auto; margin-right: auto;"></a>
    <h4 class="margin-md text-center">
      <a href="#/@" about="@" property="rdfs:label"></a>
      <br />
      <small about="@" property="rdfs:comment"></small>
    </h4>
    <div style="margin-top: auto;">
      <div about="@" rel="v-s:hasBlank" data-limit="1">
        <div class="btn-group btn-group-justified margin-sm app-fn" role="group">
          <a role="button" href="#/@" class="btn btn-success fn-icon"><span class="fa fa-plus"></span></a>
          <a role="button" href="#/@" class="btn btn-success fn-name"><span about="@" property="rdfs:label"></span></a>
        </div>
      </div>
      <div about="@" rel="v-s:hasCreate" data-limit="1">
        <div class="btn-group btn-group-justified margin-sm app-fn" role="group">
          <a role="button" href="#/@" class="btn btn-success fn-icon"><span class="fa fa-plus"></span></a>
          <a role="button" href="#/@" class="btn btn-success fn-name"><span about="@" property="rdfs:label"></span></a>
        </div>
      </div>
      <div about="@" rel="v-s:hasRegistry" data-limit="1">
        <div class="btn-group btn-group-justified margin-sm app-fn" role="group">
          <a role="button" href="#/@" class="btn btn-info fn-icon"><span class="fa fa-search"></span></a>
          <a role="button" href="#/@" class="btn btn-info fn-name"><span about="@" property="rdfs:label"></span></a>
        </div>
      </div>
    </div>
    <div class="text-center no-padding">
      <a href="#/@">
        <small about="v-s:More" property="rdfs:label"></small>
      </a>
    </div>
  </div>
`;
