export default ({it, assert, Backend, Helpers, Constants, Util}) => {
  it('#020 Search with cursor', async () => {
    const user = await Backend.authenticate('bushenevvt', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
    const admin = await Backend.authenticate('karpovrt', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');

    const meeting_template = `{
      "@": "d:QueryTestResource_$i",
      "rdf:type": [{ "type": "Uri", "data": "rdfs:Resource" }],
      "v-s:creator": [{ "type": "Uri", "data": "$creator" }],
      "rdfs:label": [{ "type": "String", "data": "$i", "lang": "NONE" }]
    }`;

    await createMeetings(user, 1, 5);
    await createMeetings(admin, 6, 3);
    await createMeetings(user, 9, 3);
    const res = await createMeetings(admin, 12, 9);

    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_fulltext_indexer, res.op_id));

    const q = "'rdf:type'==='rdfs:Resource' && '@'=='d:QueryTestResource*'";
    const s = "'rdfs:label' asc";

    const params_admin1 = {
      ticket: admin.ticket,
      query: q,
      sort: s,
      top: 3,
      from: 0,
    };
    const results_admin1 = await Backend.query(params_admin1);
    assert(results_admin1.count === 3 && results_admin1.cursor === 3 && results_admin1.processed === 3);

    const params_admin2 = {
      ticket: admin.ticket,
      query: q,
      sort: s,
      top: 10,
      from: 10,
    };
    const results_admin2 = await Backend.query(params_admin2);
    assert(results_admin2.count === 10 && results_admin2.cursor === 20 && results_admin2.processed === 10);

    const params_user1 = {
      ticket: user.ticket,
      query: q,
      sort: s,
      top: 6,
      from: 0,
    };
    const results_user1 = await Backend.query(params_user1);
    assert(results_user1.count === 6 && results_user1.cursor === 9 && results_user1.processed === 9);

    const params_user2 = {
      ticket: user.ticket,
      query: q,
      sort: s,
      top: 10,
      limit: 10,
      from: 3,
    };
    const results_user2 = await Backend.query(params_user2);
    assert(results_user2.count === 5 && results_user2.cursor === 13 && results_user2.processed === 10);

    async function createMeetings (creator, start, count) {
      let res;
      for (let i = start; i < start + count; i++) {
        const meeting = JSON.parse(meeting_template.replace(/\$i/g, i.toString().length === 2 ? i : '0' + i).replace(/\$creator/g, creator.user_uri));
        res = await Backend.put_individual(creator.ticket, meeting);
      }
      return res;
    }
  });
};
