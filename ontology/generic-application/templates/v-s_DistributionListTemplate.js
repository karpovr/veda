export const html = `
<div>
  <em about="rdfs:label" property="rdfs:label"></em>
  <veda-control data-type="string" property="rdfs:label"></veda-control>
  <em about="v-s:hasItem" property="rdfs:label"></em>
  <div rel="v-s:hasItem" data-template="v-ui:LabelTemplate"></div>
  <veda-control data-type="actor" property="v-s:hasItem" data-actor-type="v-s:Appointment"></veda-control>
</div>
`;
