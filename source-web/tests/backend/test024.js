export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it(`#024 Check get_membership`, async () => {
    const ticket_admin = await Helpers.get_admin_ticket();

    const res = await Backend.get_membership(ticket_admin.ticket, 'td:RomanKarpov_pref');
    let check = true;
    let found = 0;
    res['v-s:memberOf'].forEach(function (item, i) {
      switch (res['v-s:memberOf'][i]['data']) {
      case 'v-s:AllResourcesGroup':
      case 'td:RomanKarpov_pref':
      case 'v-ui:Preferences_group':
      case 'v-s:UserThing_group':
      case 'v-s:Exportable_group':
      case 'rdfs:Resource_group':
      case 'v-s:ClassAuthorized_group':
      case 'v-s:Thing_group':
      case 'v-s:GroupAuthorized_group':
      case 'v-s:Embedded_group':
      case 'v-s:Labeled_group':
      case 'cfg:TTLResourcesGroup':
        found++;
        break;
      default:
        check = false;
        break;
      }
    });

    assert(check && (found == 3));
  });
};
