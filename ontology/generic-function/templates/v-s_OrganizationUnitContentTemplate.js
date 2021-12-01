import $ from 'jquery';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var blank = new IndividualModel("v-s:ContactsInUnitSearchRegistryBlank");
  return blank.load().then(function (blank) {
    blank.initBlank().then(function (blankObject) {
      if ( !blankObject.hasValue("v-s:parentUnit", individual) ) {
        blankObject["v-s:parentUnit"] = [ individual ];
        var search = new IndividualModel("v-s:ContactsInUnitSearch");
        return search.load().then(function (search) {
          search["v-fs:searchResult"] = [];
        });
      }
    });
  });
};

export const html = `
<div>
  <h4><span about="@" property="rdfs:label"></span></h4>
  <span about="@" data-template="v-ui:RabbitHole" data-properties="v-s:parentUnit"></span>
  <hr>
  <div about="v-s:ContactsInUnitSearch" data-template="v-fs:AttributiveSearchInlineTemplate"></div>
</div>
`;