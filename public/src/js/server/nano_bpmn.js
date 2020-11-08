veda.Module(function(veda) {
    "use strict";

    veda.bpmn = veda.bpmn || {};

    veda.bpmn.is_all_executors_taken_decision = function(value) {
        var ticket = get_env_str_var('$ticket')
        if (!value || value.length < 1)
            return false;

        var token = get_individual(ticket, '$token');

        var f_work_orders = token['bpmn:hasWorkOrder'];
        if (!f_work_orders)
            f_work_orders = [];

        var count_agreed = 0;
        for (var i = 0; i < f_work_orders.length; i++) {
            var work_order = get_individual(ticket, veda.Util.getUri([f_work_orders[i]]));
            var decision_form = get_individual(ticket, veda.Util.getUri(work_order['bpmn:hasDecisionForm']));
            var decision = veda.Util.getUri(decision_form['bpmn:hasDecisionForm']);

            if (decision == value)
                count_agreed++;
        }

        if (count_agreed == f_work_orders.length)
            return true;
        else
            return false;

    };

    veda.bpmn.get_current_executor_or_from_start_form = function() {

        var process = get_individual(ticket, '$process');
        if (process['v-wf:to'] == undefined) {
            var start_form = get_individual(ticket, veda.Util.getUri(process['bpmn:hasStartForm']));
            if (start_form != undefined) {
                var to = start_form['v-wf:to'];
                if (to != undefined) {
                    return [veda.Util.getUri(to)];
                }
            }
        }

        return [];
    };

});