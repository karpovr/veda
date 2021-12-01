import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (individual.hasValue("rdf:type", "v-s:Appointment")) {
    $("#orgLabel", template).remove();
    $("span.unit-icon", template).remove();
    $("div.logo-image", template).remove();
    return individual.getPropertyChain("v-s:employee", "v-s:hasImage").then(function(image) {
      if (image.length == 0) {
        individual["v-s:employee"][0]["v-s:hasImage"] = [new IndividualModel("v-s:DefaultPhoto")];
      }
      return true;
    });
  } else {
    var icon = "fa fa-lg";
    if (individual.hasValue('rdf:type', 'v-s:Organization')) {
      $("span.unit-icon", template).remove();
    } else if (individual.hasValue('rdf:type', 'v-s:Department' ) || individual.hasValue('rdf:type', 'v-s:OrgGroup')) {
      icon = icon+" fa-folder-o";
      $("span.unit-icon", template).addClass(icon);
      $("div.logo-image", template).remove();
    }
    $("div.unit-image", template).remove();
    $("#appLabel", template).remove();
  };
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  function trunc (el) {
    var elTxt = el.text();
    if (elTxt.length > 35) { el.text( elTxt.substr(0, 35) + "..." ); }
  }

  var commMeansPromises;
  if (individual.hasValue("v-s:employee")) {
    if (individual["v-s:employee"][0].hasValue("mnd-s:hasEmployeeProfile")) {
      var profile  = individual["v-s:employee"][0]["mnd-s:hasEmployeeProfile"][0];
      $(".profileIcon", template).removeClass("hidden");
      $(".profileIcon", template).click(function(e) {
        e.preventDefault();
        BrowserUtil.showModal(profile);
      });
    }
    var isAppHasComm = individual["v-s:employee"][0].hasValue("v-s:hasCommunicationMean");
    if (isAppHasComm) {
      commMeansPromises = individual["v-s:employee"][0]["v-s:hasCommunicationMean"].map(function(commMean) {
        return commMean.load();
      });
    }
    if (!individual["v-s:employee"][0].hasValue("v-s:dateAbsenceTo")) {
      $(".absenceBlock", template).remove();
    }
    trunc($(".for-trunc .label-template", template));
  } else {
    if (individual.hasValue("v-s:hasCommunicationMean")) {
      commMeansPromises = individual["v-s:hasCommunicationMean"].map(function(commMean) {
        return commMean.load();
      });
    }
  }

  if (commMeansPromises == undefined) {
    $(".communication-container", template).remove();
  } else {
    var faviconIcon = $("span.faviconIcon", template);
    faviconIcon.removeClass("hidden");
    var contactHolder = faviconIcon.closest("tr").attr("resource");
    if (veda.user.aspect.hasValue("v-s:hasFavoriteContact", contactHolder)) {
      faviconIcon.toggleClass("fa-star-o fa-star");
    };

    faviconIcon.click(function(){
      if (faviconIcon.hasClass("fa-star-o")) {
        veda.user.aspect.addValue("v-s:hasFavoriteContact", new IndividualModel(contactHolder));
      } else if (faviconIcon.hasClass("fa-star")) {
        veda.user.aspect.removeValue("v-s:hasFavoriteContact", new IndividualModel(contactHolder));
      };
      veda.user.aspect.save();
      faviconIcon.toggleClass("fa-star-o fa-star");
    });

    return Promise.all(commMeansPromises).then(function(commMeans) {
      commMeans.forEach(function(commMean) {
        if (commMean.hasValue("v-s:hasCommunicationMeanChannel", "d:o3q2gagyvfwh430io88vvb8vel")) {
          var phones = commMean["v-s:description"][0];
          if (phones.indexOf(",") > 0) {
            phones = phones.split(", ");
          } else {
            phones = [phones];
          }
          phones.forEach(function(phone) {
            $(".work-phone", template).append("<div><a href='tel:" + phone + "'>" + phone + "</a></div>");
          });
        } else if (commMean.hasValue("v-s:hasCommunicationMeanChannel", "d:a1iwni0b54fvcz41vuts08bxqsh")) {
          var aDiv = $("<div><a class='email-link' style='cursor: pointer;'></a></div>");
          $("a", aDiv).attr("href", "mailto:" + commMean["v-s:description"][0]).text(commMean["v-s:description"][0]);
          $(".email", template).append(aDiv);
        } else {
          var phones = commMean["v-s:description"][0];
          if (phones.indexOf(" ") > 0) {
            phones = phones.split(" ");
          } else {
            phones = [phones];
          }
          phones.forEach(function(phone) {
            $(".other-phone", template).append("<div><a href='tel:" + phone + "'>" + phone + "</a></div>");
          });
        }
      });
    });
  }
};

export const html = `
<tr>
  <td width="80px">
    <div class="unit-image" about="@" rel="v-s:employee">
      <div about="@" rel="v-s:hasImage" style="width:60px; height:80px">
        <div class="img-thumbnail pointer" about="@" data-template="v-ui:ImageTemplate"></div>
      </div>
    </div>
    <div class="logo-image" about="@" rel="v-s:hasImage" style="width:50px; height:50px">
      <div class="img-thumbnail" about="@" data-template="v-ui:ImageTemplate"></div>
    </div>
    <span class="unit-icon"></span>
  </td>
  <td width="320px">
    <div id="orgLabel" about="@" property="rdfs:label"></div>
    <div id="appLabel" style="white-space: nowrap;overflow-x: hidden;text-overflow: ellipsis;width:320px">
      <div about="@" rel="v-s:employee">
        <div>
          <span about="@" property="v-s:lastName"></span>
          <span about="@" property="v-s:firstName"></span>
          <span about="@" property="v-s:middleName"></span>
        </div>
      </div>
      <div class="for-trunc" about="@" rel="v-s:occupation" data-template="v-ui:LabelTemplate">
      </div>
      <div class="absenceBlock" about="@" rel="v-s:employee">
        <span about="v-s:AbsenceUntilBundle" property="rdfs:label"></span><span about="@" property="v-s:dateAbsenceTo"></span>
        <div about="@" rel="v-s:delegate">
          <span about="v-s:delegate" property="rdfs:label"></span><span property="rdfs:label"></span>
        </div>
      </div>
    </div>
  </td>
  <td class="hideInStructure">
    <div>
      <span class="fa fa-lg fa-sitemap open-structure pointer margin-sm-h"></span>
      <span about="@" rel="v-s:parentOrganization" data-template="v-ui:LabelTemplate"></span>
    </div>
  </td>
  <td>
    <div class="communication-container row">
      <div class="work-phone col-lg-3 col-md-12"></div>
      <div class="email col-lg-6 col-md-12" style="overflow-x: hidden;"></div>
      <div class="other-phone col-lg-3 col-md-12"></div>
    </div>
  </td>
  <td width="20px">
    <div>
      <span class="hidden faviconIcon pointer fa fa-lg fa-star-o"></span>
    </div>
    <div>
      <a href="#" class="hidden margin-xs-h profileIcon pointer fa fa-lg fa-id-badge"></a>
    </div>
    <div>
      <span about="@" class="zoom hidden" style="float:right;" data-template="v-ui:IconModalTemplate"></span>
    </div>
  </td>
</tr>
`;
