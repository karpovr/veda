import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container) {
  template = $(template);
  container = $(container);

  if (veda.user.id !== "cfg:Administrator") {
    $(".trusted-ticket", template).remove();
  }
  $("#install-Module").click(function(){
    let url=$("#moduleUrl",template).val();
    if (url) {
      var Module = new IndividualModel();
      Module["rdf:type"] = [ new IndividualModel("v-s:RequestToModulesManager") ];
      Module["v-s:moduleUrl"]=[ url ];
      Module.save();
      $("#moduleUrl",template).val("");
    };
  });

  setTimeout(function () {
    $("#admin-tabs", template).on("click", "a", function (e) {
      e.preventDefault();
      individual.activeTab = $(this).attr("href");
    });
    if (individual.activeTab) {
      $("#admin-tabs a[href='" + individual.activeTab + "']", template).tab("show");
    } else {
      $("#admin-tabs a:first", template).tab("show");
    }
  }, 0);
};

export const html = `
<div class="container sheet" style="position:relative;">
  <h2 about="@" property="rdfs:label"></h2>
  <br>
  <ul id="admin-tabs" class="nav nav-pills" role="tablist">
    <li role="presentation"><a href="#Classes" aria-controls="Classes" role="tab" data-toggle="tab" about="v-s:ClassesBundle" property="rdfs:label"></a></li>
    <!--li role="presentation"><a href="#Blanks" aria-controls="Blanks" role="tab" data-toggle="tab" about="v-s:BlanksBundle" property="rdfs:label"></a></li>
    <li role="presentation"><a href="#Registries" aria-controls="Registries" role="tab" data-toggle="tab" about="v-s:RegistriesBundle" property="rdfs:label"></a></li-->
    <li role="presentation"><a href="#Nets" aria-controls="Nets" role="tab" data-toggle="tab" about="v-s:NetsBundle" property="rdfs:label"></a></li>
    <li role="presentation"><a href="#Rights" aria-controls="Rights" role="tab" data-toggle="tab" about="v-s:RightsManagementBundle" property="rdfs:label"></a></li>
    <li role="presentation"><a href="#Scripts" aria-controls="Scripts" role="tab" data-toggle="tab" about="v-s:ScriptsBundle" property="rdfs:label"></a></li>
    <li role="presentation"><a href="#Modules" aria-controls="Modules" role="tab" data-toggle="tab" about="v-s:ModulesBundle" property="rdfs:label"></a></li>
    <li role="presentation"><a href="#BugReports" aria-controls="BugReports" role="tab" data-toggle="tab" about="v-s:BugReportsBundle" property="rdfs:label"></a></li>
    <li role="presentation"><a href="#News" aria-controls="News" role="tab" data-toggle="tab" about="v-s:NewsBundle" property="rdfs:label"></a></li>
    <li role="presentation"><a href="#OrgStructure" aria-controls="OrgStructure" role="tab" data-toggle="tab" about="v-s:OrgStructureBundle" property="rdfs:label"></a></li>
    <li role="presentation" class="trusted-ticket"><a href="#TrustedTicket" aria-controls="TrustedTicket" role="tab" data-toggle="tab" about="v-s:TrustedTicketBundle" property="rdfs:label"></a></li>
  </ul>
  <br>
  <!-- Tab panes -->
  <div class="tab-content">

    <div role="tabpanel" class="tab-pane" id="Classes">

      <div class="row">
        <div class="col-md-6">
          <h3 about="v-s:ClassesBundle" property="rdfs:label"></h3>
          <div class="panel panel-default">
            <div class="panel-heading"><span about="v-s:ClassRegistry" property="rdfs:label"></span><a href="#/v-s:ClassBlank" about="v-s:CreateBundle" property="rdfs:label" class="btn btn-xs btn-default pull-right"></a></div>
            <div class="panel-body" about="v-s:ClassRegistry" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
          </div>
        </div>
        <div class="col-md-6">
          <h3 about="v-s:PropertiesBundle" property="rdfs:label"></h3>
          <div class="panel panel-default">
            <div class="panel-heading"><span about="v-s:PropertyRegistry" property="rdfs:label"></span><a href="#/v-s:PropertyBlank" about="v-s:CreateBundle" property="rdfs:label" class="btn btn-xs btn-default pull-right"></a></div>
            <div class="panel-body" about="v-s:PropertyRegistry" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col-md-6">
          <h3 about="v-s:TemplatesBundle" property="rdfs:label"></h3>
          <div class="panel panel-default">
            <div class="panel-heading"><span about="v-s:ClassTemplateRegistry" property="rdfs:label"></span><a href="#/v-s:ClassTemplateBlank" about="v-s:CreateBundle" property="rdfs:label" class="btn btn-xs btn-default pull-right"></a></div>
            <div class="panel-body" about="v-s:ClassTemplateRegistry" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
          </div>
        </div>
      </div>
    </div>

    <!--div role="tabpanel" class="tab-pane" id="Blanks">
      <h3 about="v-s:BlanksBundle" property="rdfs:label"></h3>
      <div class="panel panel-default">
        <div class="panel-heading"><span about="v-s:BlankRegistry" property="rdfs:label"></span><a href="#/v-s:BlankBlank" about="v-s:CreateBundle" property="rdfs:label" class="btn btn-xs btn-default pull-right"></a></div>
        <div class="panel-body" about="v-s:BlankRegistry" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
      </div>

    </div>

    <div role="tabpanel" class="tab-pane" id="Registries">
      <h3 about="v-s:RegistriesBundle" property="rdfs:label"></h3>
      <div class="panel panel-default">
        <div class="panel-heading"><span about="v-s:RegistryRegistry" property="rdfs:label"></span><a href="#/v-s:RegistryBlank" about="v-s:CreateBundle" property="rdfs:label" class="btn btn-xs btn-default pull-right"></a></div>
        <div class="panel-body" about="v-s:RegistryRegistry" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
      </div>

    </div-->

    <div role="tabpanel" class="tab-pane" id="Nets">
      <h3 about="v-s:NetsBundle" property="rdfs:label"></h3>
      <div class="panel panel-default">
        <div class="panel-heading">
          <span about="v-s:NetRegistry" property="rdfs:label"></span>
          <a href="#/v-s:NetBlank" about="v-s:CreateBundle" property="rdfs:label" class="btn btn-xs btn-default pull-right"></a>
        </div>
        <div class="panel-body" about="v-s:NetRegistry" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
      </div>
    </div>

    <div role="tabpanel" class="tab-pane" id="Rights">
      <div class="panel panel-default">
        <div about="v-s:RightsApplication" data-template="v-s:ApplicationTemplate"></div>
      </div>

      <div class="row">
        <div class="col-md-6">
          <h3 about="v-s:GroupsBundle" property="rdfs:label"></h3>
          <div class="panel panel-default">
            <div class="panel-heading"><span about="v-s:GroupRegistry" property="rdfs:label"></span><a href="#/v-s:GroupBlank" about="v-s:CreateBundle" property="rdfs:label" class="btn btn-xs btn-default pull-right"></a></div>
            <div class="panel-body" about="v-s:GroupRegistry" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
          </div>
        </div>
        <div class="col-md-6">
          <h3 about="v-s:UsersBundle" property="rdfs:label"></h3>
          <div class="panel panel-default">
            <div class="panel-heading"><span about="v-s:PersonRegistry" property="rdfs:label"></span><a href="#/v-s:PersonBlank" about="v-s:CreateBundle" property="rdfs:label" class="btn btn-xs btn-default pull-right"></a></div>
            <div class="panel-body" about="v-s:PersonRegistry" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
          </div>
        </div>
      </div>
      <!--div class="row">
        <div class="col-md-6">
          <h3 about="v-s:PermissionStatementsBundle" property="rdfs:label"></h3>
          <div class="panel panel-default">
            <div class="panel-heading"><span about="v-s:PermissionStatementRegistry" property="rdfs:label"></span><a href="#/v-s:PermissionStatementBlank" about="v-s:CreateBundle" property="rdfs:label" class="btn btn-xs btn-default pull-right"></a></div>
            <div class="panel-body" about="v-s:PermissionStatementRegistry" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
          </div>
        </div>
      </div-->
      <div class="row">
        <div class="col-md-6">
          <h3 about="v-s:AuthGroupGeneratorsBundle" property="rdfs:label"></h3>
          <div class="panel panel-default">
            <div class="panel-heading"><span about="v-s:GroupGenerator" property="rdfs:label"></span><a href="#/v-s:GroupGeneratorBlank_Admin" about="v-s:CreateBundle" property="rdfs:label" class="btn btn-xs btn-default pull-right"></a></div>
            <div class="panel-body" about="v-s:GroupGeneratorRegistry_Admin" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
          </div>
        </div>
        <div class="col-md-6">
          <h3 about="v-s:PermissionGeneratorsBundle" property="rdfs:label"></h3>
          <div class="panel panel-default">
            <div class="panel-heading"><span about="v-s:PermissionGeneratorRegistry" property="rdfs:label"></span><a href="#/v-s:PermissionGeneratorBlank_Admin" about="v-s:CreateBundle" property="rdfs:label" class="btn btn-xs btn-default pull-right"></a></div>
            <div class="panel-body" about="v-s:PermissionGeneratorRegistry_Admin" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
          </div>
        </div>
      </div>
    </div>

    <div role="tabpanel" class="tab-pane" id="Scripts">
      <div class="row">
        <div class="col-md-6">
          <div class="panel panel-default">
            <div class="panel-heading">
              <span about="v-s:UserScriptRegistry" property="rdfs:label"></span>
              <a href="#/v-s:UserScriptBlank" about="v-s:CreateBundle" property="rdfs:label" class="btn btn-xs btn-default pull-right"></a>
            </div>
            <div class="panel-body" about="v-s:UserScriptRegistry" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="panel panel-default">
            <div class="panel-heading">
              <span about="v-s:OperationRegistry" property="rdfs:label"></span>
            </div>
            <div class="panel-body" about="v-s:OperationRegistry" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
          </div>
        </div>
      </div>
    </div>

    <div role="tabpanel" class="tab-pane" id="Modules">
      <h3 about="v-s:ModulesBundle" property="rdfs:label"></h3>
      <div class="panel panel-default">
        <div class="panel-heading">
          <div class="row">
            <div class="col-md-10">
              <div class="input-group">
                <span about="v-s:moduleUrl" property='rdfs:label' class="input-group-addon"></span>
                <input id="moduleUrl" type="text" class="form-control">
              </div>
            </div>
            <div class="col-md-2">
              <button type="submit" class="action btn btn-primary btn-block view pull-right" id="install-Module">Установить</button>
            </div>
          </div>
        </div>
        <div class="panel-body">
          <div about="v-s:ModulesRegistry" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
        </div>
      </div>
    </div>

    <div role="tabpanel" class="tab-pane" id="BugReports">
      <h3 about="v-s:BugReportsBundle" property="rdfs:label"></h3>
      <div class="panel panel-default">
        <div class="panel-heading">
          <span about="v-s:BugReportRegistry" property="rdfs:label"></span>
          <a href="#/v-s:BugReportBlank" about="v-s:CreateBundle" property="rdfs:label" class="btn btn-xs btn-default pull-right"></a>
        </div>
        <div class="panel-body" about="v-s:BugReportRegistry" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
      </div>
    </div>

    <div role="tabpanel" class="tab-pane" id="News">
      <h3 about="v-s:NewsBundle" property="rdfs:label"></h3>
      <div class="panel panel-default">
        <div class="panel-heading">
          <span about="v-s:NewsSearch" property="rdfs:label"></span>
          <a href="#/v-s:NewsBlank" about="v-s:CreateBundle" property="rdfs:label" class="btn btn-xs btn-default pull-right"></a>
        </div>
        <div class="panel-body" about="v-s:NewsSearch" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
      </div>
    </div>

    <div role="tabpanel" class="tab-pane" id="OrgStructure">
      <div about="v-s:OrganizationStructureApplication" data-template="v-s:ApplicationTemplate"></div>
    </div>

    <div role="tabpanel" class="tab-pane trusted-ticket" id="TrustedTicket">
      <!-- <h3 about="v-s:TrustedTicketBundle" property="rdfs:label"></h3> -->
      <div class="panel panel-default">
        <div class="panel-heading">
          <span about="v-s:TrustedTicketBundle" property="rdfs:label"></span>
        </div>
        <div class="panel-body" about="v-s:TrustedTicket" data-template="v-ui:TrustedTicketTemplate"></div>
      </div>
    </div>
  </div>
</div>
`;