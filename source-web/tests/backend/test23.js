export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it('#023 test get_rights_origin', async () => {
    const ticket_admin = await Helpers.get_admin_ticket();

    let res = await Backend.get_rights_origin(ticket_admin.ticket, 'td:RomanKarpov_pref');
    let result_rights = 0;
    res.forEach(function (item, i) {
      if (res[i]['v-s:canCreate']) {
        result_rights |= 1;
      } else if (res[i]['v-s:canRead']) {
        result_rights |= 2;
      } else if (res[i]['v-s:canUpdate']) {
        result_rights |= 4;
      } else if (res[i]['v-s:canDelete']) {
        result_rights |= 8;
      }
    });

    res = await Backend.get_rights(ticket_admin.ticket, 'td:RomanKarpov_pref');
    let expected_rights = 0;
    if (res['v-s:canCreate']) {
      expected_rights |= 1;
    }
    if (res['v-s:canRead']) {
      expected_rights |= 2;
    }
    if (res['v-s:canUpdate']) {
      expected_rights |= 4;
    }
    if (res['v-s:canDelete']) {
      expected_rights |= 8;
    }

    assert(result_rights === expected_rights);
  });
};
