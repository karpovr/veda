import IndividualModel from '/js/common/individual_model.js';

export const pre = async function (individual, template, container, mode, extra) {

  const subscriptionPath = individual.hasValue('v-s:subscriptionPath') ? individual['v-s:subscriptionPath'][0] : '/';

  template.querySelector('a.label-template').setAttribute('href', `${subscriptionPath}#/@`);
  if (individual.hasValue('v-s:onDocument')) {
    try {
      const doc = await individual['v-s:onDocument'][0].load();
      if (!doc.hasValue('rdfs:label')) {
        const spanLabel = template.querySelector('#label');
        spanLabel.removeAttribute('about');
        spanLabel.removeAttribute('property');
        spanLabel.textContent = individual.id;
      }
    } catch (error) {
      console.log(error);
      alert('Ошибка загрузки объекта: ' + error.message);
    }
  }
};

export const html = `
<div about="@" rel="v-s:onDocument">
  <a class="label-template" href="#/@">
    <span about="@" rel="rdf:type">
      <span about="@" property="rdfs:label"></span>
    </span>:
    <span id="label" about="@" property="rdfs:label"></span>
  </a>
</div>
  
`;