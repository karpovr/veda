import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  progressHandler();
  statusHandler();
  individual.on('v-s:progress', progressHandler);
  individual.on('v-s:hasStatus', statusHandler);
  template.one('remove', function () {
    individual.off('v-s:progress', progressHandler);
    individual.off('v-s:hasStatus', statusHandler);
  });

  function progressHandler() {
    var progress = (individual.hasValue('v-s:progress') && individual['v-s:progress'][0]) || 0;
    $('.progress-bar', template).css({ width: progress + '%' });
  }
  function statusHandler() {
    var progressBar = $('.progress-bar', template),
      status = individual.hasValue('v-s:hasStatus') ? individual['v-s:hasStatus'][0].id : undefined;
    switch (status) {
      case 'v-s:StatusStarted':
      case 'v-s:StatusExecution':
        progressBar.addClass('progress-bar-success active').removeClass('progress-bar-danger');
        break;
      case 'v-s:StatusExecuted':
        progressBar.addClass('progress-bar-success').removeClass('progress-bar-danger active');
        break;
      default:
        progressBar.addClass('progress-bar-danger').removeClass('progress-bar-success active');
        break;
    }
  }
};

export const html = `
  <div class="pull-left">
    <div class="progress pull-left" style="display: inline-block; height: 22px; width:100px; margin:0 5px;">
      <div
        class="progress-bar progress-bar-striped"
        role="progressbar"
        aria-valuenow="0"
        aria-valuemin="0"
        aria-valuemax="100"
        style="width:0%; padding-top:2px;">
        <strong about="@" property="v-s:progress"></strong><strong>%</strong>
      </div>
    </div>
  </div>
`;
