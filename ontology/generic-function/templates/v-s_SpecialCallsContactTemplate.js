import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';
import Backend from '/js/common/backend.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('.open-structure').remove();
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  $('section .section-header', template).click(function () {
    const self = $(this);
    $('span.glyphicon', self).toggleClass('glyphicon-chevron-right glyphicon-chevron-down');
    self.siblings().toggle();
  });

  function presentSearchResult (objType, container, items) {
    const promises = items.map(function (item) {
      const item2 = new IndividualModel(item);
      return item2.present($('<div></div>'), 'v-s:ContactCardTemplate');
    });
    return Promise.all(promises).then(function (templates) {
      templates.forEach(function (tmpl) {
        $('tbody', container).append(tmpl);
      });
    });
  }

  const promise_spec = Backend.query({
    ticket: veda.ticket,
    sql: "SELECT id FROM veda_tt.`v-s:Position` FINAL WHERE lowerUTF8(arrayStringConcat(v_s_origin_str, ' ')) LIKE '%spec%' and `v_s_hasCommunicationMean_str`[1]!='' and `v_s_deleted_int`[1]!=1 ORDER BY `rdfs_label_str`[1]",
    from: 0,
    top: 100,
    limit: 200,
    async: true,
  });

  const promise_group = Backend.query({
    ticket: veda.ticket,
    sql: "SELECT DISTINCT id FROM veda_tt.`v-s:Position` FINAL WHERE lowerUTF8(arrayStringConcat(v_s_origin_str, ' ')) LIKE '%group%' and lowerUTF8(arrayStringConcat(v_s_origin_str, ' ')) not LIKE '%spec%' and `v_s_hasCommunicationMean_str`[1]!='' and `v_s_deleted_int`[1]!=1 and id!='d:GLAV_DISP_position' and id!='d:SYK-SKDG_position' and id!='d:RU1121003135_pos_OptiF1C' and id!='d:SYK-RTISI_position' ORDER BY `rdfs_label_str`[1]",
    from: 0,
    top: 400,
    limit: 400,
    async: true,
  });

  return Promise.all([promise_spec, promise_group]).then(function (result) {
    presentSearchResult('pos', spec, result[0].result);
    presentSearchResult('pos', group, result[1].result);
  });
};

export const html = `
  <div>
    <section id="spec">
      <h5 class="section-header">
        <span class="glyphicon glyphicon-chevron-right"></span>
        <label about="v-s:SpecialBundle" property="rdfs:label"></label>
      </h5>
      <div class="section-content">
        <table class="table result-table">
          <tbody></tbody>
        </table>
      </div>
    </section>
    <section id="group">
      <h5 class="section-header">
        <span class="glyphicon glyphicon-chevron-right"></span>
        <label about="v-s:GroupBundle" property="rdfs:label"></label>
      </h5>
      <div class="section-content">
        <table class="table result-table">
          <tbody></tbody>
        </table>
      </div>
    </section>
  </div>
`;
