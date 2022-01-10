import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  template.one('remove', function () {
    if (individual['v-fs:cursor'][0] >= individual['v-fs:top'][0]) {
      individual['v-fs:top'] = individual['v-fs:cursor'];
    }
    individual.clearValue('v-fs:searchResult');
  });
};

export const html = '<div class="container sheet" about="@" data-template="v-fs:AttributiveSearchTemplate"></div>';
