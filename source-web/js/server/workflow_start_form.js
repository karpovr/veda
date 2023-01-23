import CommonUtil from '../common/util.js';
import ServerUtil from "./util.js";
import WorkflowUtil from "./workflow_util.js";
import Convert from "./convert.js";

/*
 *  Обработка стартовой формы и создание экземпляра процесса.
 *  Условие запуска процесса: в стартовой форме не должно быть поля v-wf:isProcess.
 *  создается экземпляр v-wf:Process с заполненными переменными из текущей формы
 *  и экземпляр v-wf:WorkItem относящийся к v-wf:InputCondition
 */

export default function PrepareStartForm (ticket, document) {
    // Если задача выдана из другой задачи, то заменить значение v-wf:processedDocument на значение v-wf:onDocument из исходной задачи
    let processedDocumentId;
    let processedDocumentValue;
    if ( document['v-wf:processedDocument'] ) {
        processedDocumentId = document['v-wf:processedDocument'][0].data;
        processedDocumentValue = document['v-wf:processedDocument'];
        const processedDocument = get_individual(ticket, processedDocumentId);
        if ( CommonUtil.hasValue(processedDocument, 'rdf:type', {data: 'v-wf:DecisionForm', type: 'Uri'} ) ) {
            processedDocumentId = processedDocument['v-wf:onDocument'] ? processedDocument['v-wf:onDocument'][0].data : processedDocument['@'];
            processedDocumentValue = processedDocument['v-wf:onDocument'] || [{data: document['@'], type: 'Uri'}];
            document['v-wf:processedDocument'] = processedDocumentValue;
            document['v-wf:hasParentTask'] = [{data: processedDocument['@'], type: 'Uri'}];
            processedDocument['v-wf:hasChildTask'] = (processedDocument['v-wf:hasChildTask'] || []).concat( ServerUtil.newUri(document['@']) );
            put_individual(ticket, processedDocument, _event_id);
        }
    } else {
        processedDocumentId = document['@'];
        processedDocumentValue = [{data: document['@'], type: 'Uri'}];
    }

    let isTrace = document['v-wf:isTrace'];
    if (isTrace && ServerUtil.getFirstValue(isTrace) === true) {
        isTrace = true;
    } else {
        isTrace = false;
    }

    const cur_doc = get_individual(ticket, document['@']);

    const hasStatusWorkflowif = cur_doc['v-wf:hasStatusWorkflow'];
    if (hasStatusWorkflowif) {
        if (ServerUtil.getUri(hasStatusWorkflowif) != 'v-wf:ToBeSent') {
            print('[WORKFLOW]:prepare_start_form, not ready to start.');
            return;
        }
    } else {
        return;
    }

    if (cur_doc['v-wf:isProcess']) {
        print('[WORKFLOW]:prepare_start_form, already started.');
        return;
    }

    // Include start form to processed document group
    if ( CommonUtil.hasValue(document, 'v-wf:processedDocument') ) {
        ServerUtil.addToGroup(ticket, ServerUtil.getUri(document['v-wf:processedDocument']), document['@'], ['v-s:canRead']);
    }

    const new_process_uri = CommonUtil.genUri() + '-prs';

    const creator_f = document['v-s:creator'];

    let author_uri;
    if ( CommonUtil.hasValue(document, 'v-s:creator') ) {
        const creator_uri = document['v-s:creator'][0].data;
        const creator = get_individual(ticket, creator_uri);
        if ( CommonUtil.hasValue(creator, 'v-s:employee') ) {
            author_uri = creator['v-s:employee'][0].data;
        }
    }

    const forNet = document['v-wf:forNet'];
    const _net = get_individual(ticket, ServerUtil.getUri(forNet));
    if (!_net) return;

    const new_vars = [];
    const transform_link = ServerUtil.getUri(document['v-wf:useTransformation']);

    print('@js transform_link=', transform_link);

    if (transform_link) {
        const transform = get_individual(ticket, transform_link);
        if (!transform) return;

        // формируем входящие переменные для нового процесса
        const process_inVars = Convert.transformation(ticket, document, transform, null, null, ServerUtil.newUri(new_process_uri));
        for (const process_inVar of process_inVars) {
            put_individual(ticket, process_inVar, _event_id);
            new_vars.push(
                {
                    data: process_inVar['@'],
                    type: 'Uri',
                });
        }
    }

    const new_process = {
        '@': new_process_uri,
        'rdf:type': ServerUtil.newUri('v-wf:Process'),
        'v-wf:instanceOf': forNet,
    };
    new_process['rdfs:label'] = [
        {
            data: 'экземпляр маршрута :' + ServerUtil.getFirstValue(_net['rdfs:label']),
            type: 'String',
        }];

    if (isTrace) {
        new_process['v-wf:isTrace'] = ServerUtil.newBool(true);
    }

    if (new_vars.length > 0) {
        new_process['v-wf:inVars'] = new_vars;
    }

    new_process['v-wf:hasStartForm'] = ServerUtil.newUri(document['@']);

    let trace_journal_uri;

    if (isTrace) {
        trace_journal_uri = WorkflowUtil.create_new_journal(ticket, ServerUtil.getTraceJournalUri(new_process_uri), ServerUtil.getJournalUri(processedDocumentId), _net['rdfs:label'], true);

        if (trace_journal_uri) {
            ServerUtil.traceToJournal(ticket, trace_journal_uri, 'started new process', CommonUtil.toJson(new_process));
            new_process['v-wf:traceJournal'] = ServerUtil.newUri(trace_journal_uri);
        }
    }

    put_individual(ticket, new_process, _event_id);

    const jrn_processed_doc_uri = ServerUtil.getJournalUri(processedDocumentId);

    if (!get_individual(ticket, jrn_processed_doc_uri)) {
        const jrn_processed_doc = {
            '@': jrn_processed_doc_uri,
            'rdf:type': ServerUtil.newUri('v-s:Journal'),
            'v-s:onDocument': processedDocumentValue,
            'v-s:created': ServerUtil.newDate(new Date()),
        };
        put_individual(ticket, jrn_processed_doc, _event_id);
    }

    WorkflowUtil.create_new_journal(ticket, ServerUtil.getJournalUri(new_process_uri), jrn_processed_doc_uri, _net['rdfs:label']);

    const jrId = CommonUtil.genUri() + '-psr';
    const journalRecord = {
        '@': jrId,
        'rdf:type': ServerUtil.newUri('v-s:ProcessStarted'),
        'v-s:processJournal': ServerUtil.newUri(ServerUtil.getJournalUri(new_process_uri)),
        'v-wf:onProcess': ServerUtil.newUri(new_process_uri),
        'v-s:onDocument': processedDocumentValue,
        'v-s:created': ServerUtil.newDate(new Date()),
    };

    if (creator_f) {
        journalRecord['v-s:actor'] = creator_f;
    }

    put_individual(ticket, journalRecord, _event_id);

    const membership = {
        '@': CommonUtil.genUri() + '-mbh',
        'rdf:type': ServerUtil.newUri('v-s:Membership'),
        'v-s:resource': ServerUtil.newUri(new_process_uri),
        'v-s:memberOf': processedDocumentValue,
        'rdfs:comment': ServerUtil.newStr('Process is in document group'),
    };
    put_individual(ticket, membership, _event_id);

    add_to_individual(ticket,
        {
            '@': processedDocumentId + 'j',
            'v-s:childRecord': ServerUtil.newUri(jrId),
        }, _event_id);

    document['v-wf:hasStatusWorkflow'] = ServerUtil.newUri('v-wf:IsSent');
    document['v-wf:hasStartForm'] = ServerUtil.newUri(document['@']);
    document['v-wf:isProcess'] = (document['v-wf:isProcess'] || []).concat( ServerUtil.newUri(new_process_uri) );
    put_individual(ticket, document, _event_id);

    // возьмем автора формы и выдадим ему полные права на процесс
    if (author_uri) {
        ServerUtil.addRight(ticket, author_uri, new_process_uri, ['v-s:canRead', 'v-s:canUpdate', 'v-s:canDelete']);
    }

    // ServerUtil.addRight(ticket, 'v-wf:WorkflowReadUser', new_process_uri, ['v-s:canRead']);
};
