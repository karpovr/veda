import $ from 'jquery';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  setTimeout(function () {
    const renderedTemplates = $("[resource$='" + individual.id.substring(2) + "']");
    renderedTemplates.each(function () {
      const renderedTemplate = $(this);
      renderedTemplate.find('a, button').addClass('disabled').attr('disabled', 'disabled');
      if (renderedTemplate.parent().prop('id') === 'main') {
        const sheet = renderedTemplate.children('.sheet').first();
        template.removeClass('hidden').prependTo(sheet.length ? sheet : renderedTemplate);
      }
    });
  }, 300);
};

export const html = `
  <div class="alert alert-warning hidden clearfix">
    <style scoped>
      p > span:not(:first-child) {
        padding-left: 0.5em;
        padding-right: 0.5em;
      }
      p > span:first-child {
        padding-right: 0.5em;
      }
    </style>
    <p class="pull-left">
      <span about="v-s:VersionAlert" property="rdfs:label"></span>
      <span about="@" rel="v-s:actualVersion">
        <a href="#/@" class="alert-link"> &uarr; <span about="v-s:actualVersion" property="rdfs:label"></span> </a>
      </span>
    </p>
    <p class="pull-right">
      <span about="@" rel="v-s:previousVersion">
        <a href="#/@" class="alert-link"> &larr; <span about="v-s:previousVersion" property="rdfs:label"></span> </a>
      </span>
      <span about="@" rel="v-s:nextVersion">
        <a href="#/@" class="alert-link"> <span about="v-s:nextVersion" property="rdfs:label"></span> &rarr; </a>
      </span>
    </p>
  </div>
`;
