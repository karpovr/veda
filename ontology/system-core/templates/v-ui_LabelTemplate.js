import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  if (!individual.hasValue('rdfs:label')) {
    template.text(individual.id);
  }
  let done;
  let initPopoverTimeout;
  const type = individual.hasValue('rdf:type') && individual['rdf:type'][0].id;
  if (type === 'v-s:Appointment' || type === 'v-s:Person' || type === 'v-s:Position' || type === 'v-s:Organization') {
    template
      .mouseenter(function () {
        if (done || initPopoverTimeout) {
          return;
        }
        initPopoverTimeout = setTimeout(initPopover, 750);
      })
      .mouseleave(function () {
        initPopoverTimeout = clearTimeout(initPopoverTimeout);
      })
      .one('remove', function () {
        template.popover('destroy');
      });
  }

  function initPopover () {
    const cntr = $('<div></div>');
    let tmpl;
    if (type === 'v-s:Appointment') {
      tmpl = 'v-ui:AppointmentPopoverTemplate';
    } else if (type === 'v-s:Person') {
      tmpl = 'v-ui:PersonPopoverTemplate';
    } else if (type === 'v-s:Organization') {
      tmpl = 'v-ui:OrganizationPopoverTemplate';
    } else {
      tmpl = 'v-ui:PositionPopoverTemplate';
    }
    individual.present(cntr, tmpl).then(function () {
      done = true;
      template
        .popover({
          trigger: 'hover click',
          delay: {show: 750, hide: 100},
          placement: 'auto bottom',
          html: true,
          container: 'body',
          content: cntr,
        })
        .popover('show');
      cntr.on('click', '.close', function (e) {
        e.stopPropagation();
        template.click();
      });
    });
  };
};

export const html = `
  <span class="label-template" about="@" property="rdfs:label"></span>
`;
