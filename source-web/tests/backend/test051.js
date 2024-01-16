import http from 'http';

function sparqlQuery(sparqlQuery) {
    //console.log(sparqlQuery)
    return new Promise((resolve, reject) => {
        const data = sparqlQuery;
        const options = {
            hostname: '127.0.0.1',
            port: 7878,
            path: '/query',
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-query',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let responseBody = '';

            res.on('data', (chunk) => {
                responseBody += chunk;
            });

            res.on('end', () => {
                try {
                    // Предполагаем, что ответ сервера в формате JSON
                    const parsedResponse = JSON.parse(responseBody);
                    resolve(parsedResponse);
                } catch (error) {
                    reject(new Error("Ошибка при разборе ответа SPARQL: " + error.message));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

export default ({
    test,
    assert,
    Backend,
    Helpers,
    Constants,
    Util
}) => {
    test.skip(`#051 Check add, remove, and update of fields in individual and their reflection in the triplestore`, async () => {

        const prefixes = `
  PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX v-s: <http://semantic-machines.com/veda/veda-schema/>
  PREFIX v-ui: <http://semantic-machines.com/veda/veda-ui/>
  PREFIX td: <http://semantic-machines.com/veda/test-data/>
  PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    `

        const ticket_user1 = await Helpers.get_user1_ticket();

        const now_d = new Date();
        const now_o = Util.newDate(now_d);
        const isoStringParts = now_d.toISOString().split('.'); // Разделение строки на части по точке
        const isoStringWithoutMilliseconds = isoStringParts[0] + 'Z'; // Соединение частей без миллисекунд и добавление 'Z'

        // put_individual
        const new_test_doc1_uri = 'td:' + Util.guid();
        const new_test_doc1 = {
            '@': new_test_doc1_uri,
            'rdf:type': Util.newUri('v-s:Document'),
            'v-s:author': Util.newUri('td:ValeriyBushenev-Programmer1'),
            'v-s:created': now_o,
            'v-s:test_field': Util.newStr('test data', 'EN'),
        };

        let res;
        res = await Backend.put_individual(ticket_user1.ticket, new_test_doc1);
        assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
        assert(await Backend.wait_module(Constants.m_acl, res.op_id));

        let read_individual;
        read_individual = await Backend.get_individual(ticket_user1.ticket, new_test_doc1_uri);
        assert(Helpers.compare(new_test_doc1, read_individual));

        // код проверяющий наличие в хранилище триплетов относящихся к субьекту new_test_doc1_uri
        const sparql_query_for_verification = `
${prefixes}

  ASK {
    ${new_test_doc1_uri} rdf:type v-s:Document ;
                           v-s:author ${new_test_doc1['v-s:author'][0].data} ;
			   v-s:created "${isoStringWithoutMilliseconds}"^^xsd:dateTime ;
                           v-s:test_field "${new_test_doc1['v-s:test_field'][0].data}"@en .
  }
`;


        let sparql_verification_res = await sparqlQuery(sparql_query_for_verification);
        assert(sparql_verification_res.boolean === true, "Индивид должен существовать в базе данных");

        // add_to_individual
        const new_test_add1 = {
            '@': new_test_doc1_uri,
            'v-s:author': [{
                    data: 'td:ValeriyBushenev-Programmer2',
                    type: 'Uri',
                },
                {
                    data: 'td:test-q',
                    type: 'Uri',
                }
            ],
        };

        res = await Backend.add_to_individual(ticket_user1.ticket, new_test_add1);
        assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
        assert(await Backend.wait_module(Constants.m_acl, res.op_id));

        const new_test_doc1_add1 = {
            '@': new_test_doc1_uri,
            'rdf:type': Util.newUri('v-s:Document'),
            'v-s:author': [{
                    data: 'td:ValeriyBushenev-Programmer1',
                    type: 'Uri',
                },
                {
                    data: 'td:ValeriyBushenev-Programmer2',
                    type: 'Uri',
                },
                {
                    data: 'td:test-q',
                    type: 'Uri',
                }
            ],
            'v-s:created': now_d,
            'v-s:test_field': Util.newStr('test data', 'EN'),
        };

        read_individual = await Backend.get_individual(ticket_user1.ticket, new_test_doc1_uri);
        assert(Helpers.compare(new_test_doc1_add1, read_individual));

        const sparql_verification_after_add1 = `
${prefixes}

ASK {
  ${new_test_doc1_uri} v-s:author ?author .
  FILTER(?author IN (td:ValeriyBushenev-Programmer1, td:ValeriyBushenev-Programmer2, td:test-q))
}
`;

        let sparql_verification_after_add1_res = await sparqlQuery(sparql_verification_after_add1);
        assert(sparql_verification_after_add1_res.boolean === true, "После добавления, все три автора должны присутствовать в базе данных");

        // set_in_individual
        let new_test_set1 = {
            '@': new_test_doc1_uri,
            'v-s:author': Util.newUri('td:test-e1'),
        };

        await Backend.set_in_individual(ticket_user1.ticket, new_test_set1);
        assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
        assert(await Backend.wait_module(Constants.m_acl, res.op_id));

        let new_test_doc1_set1 = {
            '@': new_test_doc1_uri,
            'rdf:type': Util.newUri('v-s:Document'),
            'v-s:author': Util.newUri('td:test-e1'),
            'v-s:created': now_d,
            'v-s:test_field': Util.newStr('test data', 'EN'),
        };

        read_individual = await Backend.get_individual(ticket_user1.ticket, new_test_doc1_uri);
        assert(Helpers.compare(new_test_doc1_set1, read_individual));


        // Проверка на добавление нового значения td:test-e1
        const sparql_verification_after_set1 = `
${prefixes}

ASK {
  ${new_test_doc1_uri} v-s:author td:test-e1 .
}
`;

        let sparql_verification_after_set1_res = await sparqlQuery(sparql_verification_after_set1);
        assert(sparql_verification_after_set1_res.boolean === true, "Новое значение td:test-e1 должно быть добавлено");

        // Проверка на удаление старого значения td:ValeriyBushenev-Programmer1
        const sparql_verification_removal1 = `
${prefixes}

ASK {
  ${new_test_doc1_uri} v-s:author td:ValeriyBushenev-Programmer1 .
}
`;

        let sparql_removal_verification1_res = await sparqlQuery(sparql_verification_removal1);
        assert(sparql_removal_verification1_res.boolean === false, "Старое значение td:ValeriyBushenev-Programmer1 должно быть удалено");

        // Проверка на удаление старого значения td:ValeriyBushenev-Programmer2
        const sparql_verification_removal2 = `
${prefixes}

ASK {
  ${new_test_doc1_uri} v-s:author td:ValeriyBushenev-Programmer2 .
}
`;

        let sparql_removal_verification2_res = await sparqlQuery(sparql_verification_removal2);
        assert(sparql_removal_verification2_res.boolean === false, "Старое значение td:ValeriyBushenev-Programmer2 должно быть удалено");

        // Проверка на удаление старого значения td:test-q
        const sparql_verification_removal3 = `
${prefixes}

ASK {
  ${new_test_doc1_uri} v-s:author td:test-q .
}
`;

        let sparql_removal_verification3_res = await sparqlQuery(sparql_verification_removal3);
        assert(sparql_removal_verification3_res.boolean === false, "Старое значение td:test-q должно быть удалено");


        // add_to_individual (2)
        new_test_set1 = {
            '@': new_test_doc1_uri,
            'v-s:author': Util.newUri('td:test-e2'),
        };

        await Backend.add_to_individual(ticket_user1.ticket, new_test_set1);
        assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
        assert(await Backend.wait_module(Constants.m_acl, res.op_id));

        new_test_doc1_set1 = {
            '@': new_test_doc1_uri,
            'rdf:type': Util.newUri('v-s:Document'),
            'v-s:author': [Util.newUri('td:test-e1')[0], Util.newUri('td:test-e2')[0]],
            'v-s:created': now_d,
            'v-s:test_field': Util.newStr('test data', 'EN'),
        };

        read_individual = await Backend.get_individual(ticket_user1.ticket, new_test_doc1_uri);
        assert(Helpers.compare(new_test_doc1_set1, read_individual));


        const sparql_verification_e1_unchanged = `
${prefixes}

ASK {
  ${new_test_doc1_uri} v-s:author td:test-e1 .
}
`;

        let sparql_e1_unchanged_res = await sparqlQuery(sparql_verification_e1_unchanged);
        assert(sparql_e1_unchanged_res.boolean === true, "Значение td:test-e1 должно остаться неизменным");


        // add_to_individual (3)
        new_test_set1 = {
            '@': new_test_doc1_uri,
            'v-s:author': Util.newUri('td:test-e3'),
        };

        res = await Backend.add_to_individual(ticket_user1.ticket, new_test_set1);
        assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
        assert(await Backend.wait_module(Constants.m_acl, res.op_id));

        new_test_doc1_set1 = {
            '@': new_test_doc1_uri,
            'rdf:type': Util.newUri('v-s:Document'),
            'v-s:author': [Util.newUri('td:test-e1')[0], Util.newUri('td:test-e2')[0], Util.newUri('td:test-e3')[0]],
            'v-s:created': now_d,
            'v-s:test_field': Util.newStr('test data', 'EN'),
        };

        read_individual = await Backend.get_individual(ticket_user1.ticket, new_test_doc1_uri);
        assert(Helpers.compare(new_test_doc1_set1, read_individual));


        let sparql_verification_query;
        let sparql_result;

        // Проверка на добавление нового значения td:test-e3
        sparql_verification_query = `
${prefixes}

ASK {
  ${new_test_doc1_uri} v-s:author td:test-e3 .
}
`;

        sparql_result = await sparqlQuery(sparql_verification_query);
        assert(sparql_result.boolean === true, "Значение td:test-e3 должно быть добавлено");

        // Проверка на сохранение значения td:test-e1
        sparql_verification_query = `
${prefixes}

ASK {
  ${new_test_doc1_uri} v-s:author td:test-e1 .
}
`;

        sparql_result = await sparqlQuery(sparql_verification_query);
        assert(sparql_result.boolean === true, "Значение td:test-e1 должно остаться неизменным");

        // Проверка на сохранение значения td:test-e2
        sparql_verification_query = `
${prefixes}

ASK {
  ${new_test_doc1_uri} v-s:author td:test-e2 .
}
`;

        sparql_result = await sparqlQuery(sparql_verification_query);
        assert(sparql_result.boolean === true, "Значение td:test-e2 должно остаться неизменным");


        // remove_from_individual
        const new_test_remove_from2 = {
            '@': new_test_doc1_uri,
            'v-s:author': Util.newUri('td:test-e2'),
        };

        res = await Backend.remove_from_individual(ticket_user1.ticket, new_test_remove_from2);
        assert(await Backend.wait_module(Constants.m_scripts, res.op_id));
        assert(await Backend.wait_module(Constants.m_acl, res.op_id));

        read_individual = await Backend.get_individual(ticket_user1.ticket, new_test_doc1_uri);

        const new_test_doc1_remove_from1 = {
            '@': new_test_doc1_uri,
            'rdf:type': Util.newUri('v-s:Document'),
            'v-s:created': now_d,
            'v-s:author': [Util.newUri('td:test-e1')[0], Util.newUri('td:test-e3')[0]],
            'v-s:test_field': Util.newStr('test data', 'EN'),
        };
        assert(Helpers.compare(new_test_doc1_remove_from1, read_individual));


        // Проверка на удаление значения td:test-e2
        sparql_verification_query = `
${prefixes}

ASK {
  ${new_test_doc1_uri} v-s:author td:test-e2 .
}
`;

        sparql_result = await sparqlQuery(sparql_verification_query);
        assert(sparql_result.boolean === false, "Значение td:test-e2 должно быть удалено");

        // Проверка на сохранение значения td:test-e1
        sparql_verification_query = `
${prefixes}

ASK {
  ${new_test_doc1_uri} v-s:author td:test-e1 .
}
`;

        sparql_result = await sparqlQuery(sparql_verification_query);
        assert(sparql_result.boolean === true, "Значение td:test-e1 должно остаться неизменным");

        // Проверка на сохранение значения td:test-e3
        sparql_verification_query = `
${prefixes}

ASK {
  ${new_test_doc1_uri} v-s:author td:test-e3 .
}
`;

        sparql_result = await sparqlQuery(sparql_verification_query);
        assert(sparql_result.boolean === true, "Значение td:test-e3 должно остаться неизменным");


        await Backend.remove_individual(ticket_user1.ticket, new_test_doc1['@']);
        await assert.rejects(Backend.get_individual(ticket_user1.ticket, new_test_doc1['@']));
    });
};
