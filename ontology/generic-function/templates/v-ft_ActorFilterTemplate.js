import $ from 'jquery';
import veda from '/js/common/veda.js';
import Backend from '/js/common/backend.js';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container) {
  template = $(template);
  container = $(container);

  var folder = decodeURIComponent(location.hash).substr(2).split("/")[0];

  var actor_property = folder === "v-ft:Outbox" ? "v-wf:from" :
                       folder === "v-ft:OutboxCompleted" ? "v-wf:from" :
                       folder === "v-ft:Inbox" ? "v-wf:to" :
                       folder === "v-ft:Completed" ? "v-wf:to" : "";

  var counter_prop = folder === "v-ft:Inbox" ? "v-ft:inboxCount" :
                     folder === "v-ft:Outbox" ? "v-ft:outboxCount" :
                     folder === "v-ft:Completed" ? "v-ft:completedCount" : "";

  if (!individual.hasValue(actor_property)) {
    individual[actor_property] = [veda.user];
  }

  return Backend.query({
    ticket: veda.ticket,
    query: "('rdf:type'==='v-s:Appointment' && 'v-s:employee'=='" + veda.user.id + "')"
  })
  .then(function (queryResult) {
    var appointments_uris = queryResult.result;
    return Backend.get_individuals(veda.ticket, appointments_uris);
  })
  .then(function (appointments) {
    var filtered = appointments.reduce(function(acc, appointment) {
      if ( veda.appointment && veda.appointment.id && appointment["@"] === veda.appointment.id ) {
        return acc;
      }
      if ( appointment["v-s:occupation"] && appointment["v-s:occupation"].length ) {
        var positionUri = appointment["v-s:occupation"][0].data;
        var delegationPurpose = (appointment["v-s:hasDelegationPurpose"] && appointment["v-s:hasDelegationPurpose"].length) ?
            appointment["v-s:hasDelegationPurpose"][0].data : "";
        var isControlAppointment = delegationPurpose === "d:delegate_Control";
        // official is not control
        if (acc[positionUri] == undefined) {
          acc[positionUri] = !isControlAppointment;
        }
        acc[positionUri] = acc[positionUri] || !isControlAppointment;
      }
      return acc;
    }, {"v-ft:MyBundle": true});
    console.log(filtered);
    for (var actorUri in filtered) {
      var isOfficial = filtered[actorUri];
      var notOfficialInject = isOfficial === false ? " class='not-official'" : "";
      var actor_template =
        "<li>" +
          "<a href='#'" + notOfficialInject + ">" +
            "<span class='actor' about='" + actorUri + "' property='rdfs:label'></span> " +
            //"<span id='counter' about='" + counter_uri + "' class='badge' property='" + counter_prop + "'></span>" +
          "</a>" +
        "</li>";
      actor_template = $(actor_template);
      if (isOfficial === false) {
        actor_template.popover({
          placement: "top",
          trigger: "hover",
          content: "Не официальное назначение. Только просмотр"
        });
      }
      template.append(actor_template);
    }
    // var actors_uris = [ {uri:"v-ft:MyBundle", official: true} ];
    // appointments.forEach(function (appointment) {
    //   if ( veda.appointment && veda.appointment.id && appointment["@"] === veda.appointment.id ) {
    //     return;
    //   } else if ( appointment["v-s:occupation"] && appointment["v-s:occupation"].length ) {
    //     var delegationPurpose = (appointment["v-s:hasDelegationPurpose"] && appointment["v-s:hasDelegationPurpose"].length) ?
    //         appointment["v-s:hasDelegationPurpose"][0].data : "";

    //     var isControlAppointment = delegationPurpose === "d:delegate_Control";
    //     actors_uris.push( {uri: appointment["v-s:occupation"][0].data, official: !isControlAppointment} );
    //   }
    // });

    // actors_uris.map(function (actor_data) {
    //   //var counter_uri = "d:taskCounter_" + actor_uri.split(":").join("_");
    //   var notOfficialInject = actor_data.official === false ? " class='not-official'" : "";
    //   var actor_template =
    //     "<li>" +
    //       "<a href='#'" + notOfficialInject + ">" +
    //         "<span class='actor' about='" + actor_data.uri + "' property='rdfs:label'></span> " +
    //         //"<span id='counter' about='" + counter_uri + "' class='badge' property='" + counter_prop + "'></span>" +
    //       "</a>" +
    //     "</li>";
    //   actor_template = $(actor_template);
    //   if (actor_data.official === false) {
    //     actor_template.popover({
    //       placement: "top",
    //       trigger: "hover",
    //       content: "Не официальное назначение. Только просмотр"
    //     });
    //   }
    //   template.append(actor_template);
    // });

    if ( !individual.actor ) {
      individual.actor = "v-ft:MyBundle";
    }
    if (individual.actor === "v-ft:MyBundle") {
      individual[actor_property] = [ veda.user , veda.appointment && veda.appointment.hasValue("v-s:occupation") ? veda.appointment["v-s:occupation"][0] : undefined ];
    } else {
      individual[actor_property] = [ new veda.IndividualModel(individual.actor) ];
    }
    template.find("[about='" + individual.actor + "']").closest("li").addClass("active");

    template.on("click", "li a", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var $this = $(this);
      $this.parent().addClass("active").siblings().removeClass("active");
      var actor_uri = $this.children(".actor").attr("about");
      individual.actor = actor_uri;
      if (actor_uri === "v-ft:MyBundle") {
        individual[actor_property] = [ veda.user , veda.appointment && veda.appointment.hasValue("v-s:occupation") ? veda.appointment["v-s:occupation"][0] : undefined ];
      } else {
        individual[actor_property] = [ new IndividualModel(actor_uri) ];
      }
      new IndividualModel(folder).trigger("search");
    });
  });

  // Update counter if counter & results count do not match
  /*individual.on("search:complete", checkCounter);
  template.one("remove", function () {
    individual.off(checkCounter);
  });
  function checkCounter(results) {
    try {
      var actor_uri = individual[actor_property][0].id;
      var counter_uri = "d:taskCounter_" + actor_uri.split(":").join("_");
      var counter = new IndividualModel(counter_uri);
      counter.load().then(function (counter) {
        if ( counter.isNew() ) {
          counter["rdf:type"] = [ new IndividualModel("v-ft:TaskCounter") ];
        }
        var counter_val = counter[counter_prop][0];
        if ( counter_val !== results.estimated ) {
          counter[counter_prop] = [ results.estimated ];
          counter.save();
        }
      });
    }
  }*/
};

export const html = `
<ul class="nav nav-pills" role="tablist">
  <style scoped>
    a.not-official {
      color: #333333;
    }
    li.active > a.not-official {
      color: #333333 !important;
      background-color: #ffffff !important;
      border: 1px solid;
    }
  </style>
</ul>
`;
