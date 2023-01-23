import Util from "./util.js";

const Convert = {};
export default Convert;

Convert.transformation = function (ticket, individuals, transform, executor, work_order, process) {
    try {
        const out_data0 = {};

        let element;

        if (Array.isArray(individuals) !== true) {
            individuals = [individuals];
        }

        let rules = transform['v-wf:transformRule'];

        if (!rules || !rules.length) {
            return;
        }

        const tmp_rules = [];
        for (const i in rules) {
            if (Object.hasOwnProperty.call(rules, i)) {
                const rul = get_individual(ticket, rules[i].data);
                if (!rul) {
                    print('not read rule [', Util.toJson(rul), ']');
                    continue;
                } else {
                    tmp_rules.push(rul);
                }
            }
        }
        rules = tmp_rules;

        let out_data0_el = {};

        /* PUT functions [BEGIN] */
        const putFieldOfIndividFromElement = (() => {
            return function (name, field) {
                const rr = get_individual(ticket, Util.getUri(element));
                if (!rr) {
                    return;
                }

                let out_data0_el_arr;

                out_data0_el_arr = out_data0_el[name];

                if (!out_data0_el_arr) {
                    out_data0_el_arr = [];
                }

                out_data0_el_arr.push(rr[field]);

                out_data0_el[name] = out_data0_el_arr;
            };
        })();

        const putFieldOfObject = (() => {
            return function (name, field) {
                let out_data0_el_arr;

                out_data0_el_arr = out_data0_el[name];

                if (!out_data0_el_arr) {
                    out_data0_el_arr = [];
                }

                out_data0_el_arr.push(individual[field]);

                out_data0_el[name] = out_data0_el_arr;
            };
        })();

        const putUri = (() => {
            return function (name, value) {
                let out_data0_el_arr;

                out_data0_el_arr = out_data0_el[name];

                if (!out_data0_el_arr) {
                    out_data0_el_arr = [];
                }

                out_data0_el_arr.push(
                    {
                        data: value,
                        type: 'Uri',
                    });

                out_data0_el[name] = out_data0_el_arr;
            };
        })();

        const setUri = function (name, value) {
            out_data0_el[name] = [
                {
                    data: value,
                    type: 'Uri',
                }];
        };

        const putString = (() => {
            return function (name, value) {
                let out_data0_el_arr;

                out_data0_el_arr = out_data0_el[name];

                if (!out_data0_el_arr) {
                    out_data0_el_arr = [];
                }

                out_data0_el_arr.push(
                    {
                        data: value,
                        type: 'String',
                    });

                out_data0_el[name] = out_data0_el_arr;
            };
        })();

        const setString = (() => {
            return function (name, value) {
                const out_data0_el_arr = [];

                out_data0_el_arr.push(
                    {
                        data: value,
                        type: 'String',
                    });

                out_data0_el[name] = out_data0_el_arr;
            };
        })();

        const setDatetime = (() => {
            return function (name, value) {
                const out_data0_el_arr = [];

                out_data0_el_arr.push(
                    {
                        data: value,
                        type: 'Datetime',
                    });

                out_data0_el[name] = out_data0_el_arr;
            };
        })();

        const putDatetime = (() => {
            return function (name, value) {
                let out_data0_el_arr;

                out_data0_el_arr = out_data0_el[name];

                if (!out_data0_el_arr) {
                    out_data0_el_arr = [];
                }

                out_data0_el_arr.push(
                    {
                        data: value,
                        type: 'Datetime',
                    });

                out_data0_el[name] = out_data0_el_arr;
            };
        })();

        const putBoolean = (() => {
            return function (name, value) {
                let out_data0_el_arr;

                out_data0_el_arr = out_data0_el[name];

                if (!out_data0_el_arr) {
                    out_data0_el_arr = [];
                }

                out_data0_el_arr.push(
                    {
                        data: value,
                        type: 'Boolean',
                    });

                out_data0_el[name] = out_data0_el_arr;
            };
        })();

        const setBoolean = (() => {
            return function (name, value) {
                const out_data0_el_arr = [];

                out_data0_el_arr.push(
                    {
                        data: value,
                        type: 'Boolean',
                    });

                out_data0_el[name] = out_data0_el_arr;
            };
        })();


        const putInteger = (() => {
            return function (name, value) {
                let out_data0_el_arr = out_data0_el[name];

                if (!out_data0_el_arr) {
                    out_data0_el_arr = [];
                }

                out_data0_el_arr.push(
                    {
                        data: value,
                        type: 'Integer',
                    });

                out_data0_el[name] = out_data0_el_arr;
            };
        })();

        const setInteger = (() => {
            return function (name, value) {
                const out_data0_el_arr = [];

                out_data0_el_arr.push(
                    {
                        data: value,
                        type: 'Integer',
                    });

                out_data0_el[name] = out_data0_el_arr;
            };
        })();

        const putExecutor = (() => {
            return function (name) {
                let out_data0_el_arr = out_data0_el[name];

                if (!out_data0_el_arr) {
                    out_data0_el_arr = [];
                }

                if (Array.isArray(executor) === true) {
                    for (const key3 in executor) {
                        if (Object.hasOwnProperty.call(executor, key3)) {
                            out_data0_el_arr.push(executor[key3]);
                        }
                    }
                } else {
                    out_data0_el_arr.push(executor);
                }

                out_data0_el[name] = out_data0_el_arr;
            };
        })();

        const putWorkOrder = (() => {
            return function (name) {
                let out_data0_el_arr = out_data0_el[name];

                if (!out_data0_el_arr) {
                    out_data0_el_arr = [];
                }

                if (Array.isArray(work_order) === true) {
                    for (const key3 in work_order) {
                        if (Object.hasOwnProperty.call(work_order, key3)) {
                            out_data0_el_arr.push(work_order[key3]);
                        }
                    }
                } else {
                    out_data0_el_arr.push(work_order);
                }

                out_data0_el[name] = out_data0_el_arr;
            };
        })();

        const putThisProcess = (() => {
            return function (name) {
                let out_data0_el_arr = out_data0_el[name];

                if (!out_data0_el_arr) {
                    out_data0_el_arr = [];
                }

                if (Array.isArray(process) === true) {
                    for (const key3 in process) {
                        if (Object.hasOwnProperty.call(process, key3)) {
                            out_data0_el_arr.push(process[key3]);
                        }
                    }
                } else {
                    out_data0_el_arr.push(process);
                }

                out_data0_el[name] = out_data0_el_arr;
            };
        })();

        const removeThisProcess = (() => {
            return function (name) {
                let out_data0_el_arr = out_data0_el[name];

                if (!out_data0_el_arr) {
                    out_data0_el_arr = [];
                }

                if (Array.isArray(process) === true) {
                    for (const key3 in process) {
                        if (Object.hasOwnProperty.call(process, key3)) {
                            out_data0_el_arr = out_data0_el_arr.filter((value) => {
                                return value.data !== process[key3];
                            });
                        }
                    }
                } else {
                    out_data0_el_arr = out_data0_el_arr.filter((value) => {
                        return value.data !== process;
                    });
                }

                out_data0_el[name] = out_data0_el_arr;
            };
        })();

        /* PUT functions [END] */

        for (const key in individuals) {
            if (Object.hasOwnProperty.call(individuals, key)) {
                const individual = individuals[key];

                const objectContentStrValue = (() => {
                    return function (name, value) {
                        if (individual[name]) {
                            let result = false;
                            for (const i in individual[name]) {
                                if (value === individual[name][i].data) {
                                    result = true;
                                }
                            }
                            return result;
                        }
                    };
                })();

                const iteratedObject = Object.keys(individual);

                for (const property of iteratedObject) {
                    element = individual[property];

                    const putValue = (() => {
                        return function (name) {
                            let out_data0_el_arr = out_data0_el[name];

                            if (!out_data0_el_arr) {
                                out_data0_el_arr = [];
                            }

                            if (property == '@') {
                                out_data0_el_arr.push(
                                    {
                                        data: element,
                                        type: 'Uri',
                                    });
                            } else {
                                if (Array.isArray(element) === true) {
                                    for (const key3 in element) {
                                        if (Object.hasOwnProperty.call(element, key3)) {
                                            out_data0_el_arr.push(element[key3]);
                                        }
                                    }
                                } else {
                                    out_data0_el_arr.push(element);
                                }
                            }

                            out_data0_el[name] = out_data0_el_arr;
                        };
                    })();

                    const putValueFrom = (() => {
                        return function (name, path) {
                            let out_data0_el_arr = out_data0_el[name];
                            if (!out_data0_el_arr) {
                                out_data0_el_arr = [];
                            }

                            let element_uri;

                            if (Array.isArray(element) === true) {
                                element_uri = Util.getUri(element);
                            } else {
                                element_uri = element.data ? element.data : element;
                            }

                            let curelem;

                            curelem = get_individual(ticket, element_uri);

                            for (let i = 0; i < path.length - 1; i++) {
                                if (!curelem || !curelem[path[i]]) return;
                                const uri = Array.isArray(curelem[path[i]]) && curelem[path[i]][0].data ? curelem[path[i]][0].data : curelem[path[i]];
                                curelem = get_individual(ticket, uri);
                            }
                            if (!curelem || !curelem[path[path.length - 1]]) return;

                            out_data0_el_arr = out_data0_el_arr.concat(curelem[path[path.length - 1]]);

                            out_data0_el[name] = out_data0_el_arr;
                        };
                    })();

                    const putFrontValue = (() => {
                        return function (name) {
                            let out_data0_el_arr = out_data0_el[name];

                            if (!out_data0_el_arr) {
                                out_data0_el_arr = [];
                            }
                            if (property == '@') {
                                out_data0_el_arr.unshift(
                                    {
                                        data: element,
                                        type: 'Uri',
                                    });
                            } else {
                                if (Array.isArray(element) === true) {
                                    for (const key3 in element) {
                                        if (Object.hasOwnProperty.call(element, key3)) {
                                            out_data0_el_arr.unshift(element[key3]);
                                        }
                                    }
                                } else {
                                    out_data0_el_arr.unshift(element);
                                }
                            }

                            out_data0_el[name] = out_data0_el_arr;
                        };
                    })();

                    const putElement = (() => {
                        return function () {
                            const name = property;
                            if (name == '@') {
                                return;
                            }

                            let out_data0_el_arr = [];
                            out_data0_el_arr = out_data0_el[name];

                            if (!out_data0_el_arr) {
                                out_data0_el_arr = [];
                            }

                            if (Array.isArray(element) === true) {
                                for (const key3 in element) {
                                    if (Object.hasOwnProperty.call(element, key3)) {
                                        out_data0_el_arr.push(element[key3]);
                                    }
                                }
                            } else {
                                out_data0_el_arr.push(element);
                            }

                            out_data0_el[name] = out_data0_el_arr;
                        };
                    })();

                    /* Segregate functions [BEGIN] */
                    const contentName = (() => {
                        return function (name) {
                            return property == name;
                        };
                    })();

                    const elementContentStrValue = (() => {
                        return function (name, value) {
                            if (property !== name) {
                                return false;
                            }
                            const str = element[0].data;
                            return str == value;
                        };
                    })();
                    /* Segregate functions [END] */

                    const getElement = (() => {
                        return function () {
                            return element;
                        };
                    })();


                    // выполняем все rules
                    for (const key3 in rules) {
                        if (Object.hasOwnProperty.call(rules, key3)) {
                            const rule = rules[key3];
                            // 1. v-wf:segregateObject
                            const segregateObject = rule['v-wf:segregateObject'];

                            // 2. v-wf:segregateElement
                            const segregateElement = rule['v-wf:segregateElement'];
                            const grouping = rule['v-wf:grouping'];

                            let res = undefined;

                            if (segregateObject) {
                                res = eval(segregateObject[0].data);
                                if (!res) {
                                    continue;
                                }
                            }

                            if (segregateElement) {
                                res = eval(segregateElement[0].data);
                                if (!res) {
                                    continue;
                                }
                            }

                            // 3. v-wf:aggregate
                            let group_key;
                            if (!grouping) {
                                out_data0_el = {};
                                out_data0_el['@'] = Util.genUri() + '-tr';
                            } else {
                                let useExistsUid = false;
                                for (const i in grouping) {
                                    if (Object.hasOwnProperty.call(grouping, i)) {
                                        const gk = grouping[i].data;
                                        if (gk == '@') {
                                            useExistsUid = true;
                                        } else {
                                            group_key = gk;
                                        }
                                    }
                                }

                                out_data0_el = out_data0[group_key];
                                if (!out_data0_el) {
                                    out_data0_el = {};
                                    if (useExistsUid) {
                                        out_data0_el['@'] = individual['@'];
                                    } else {
                                        out_data0_el['@'] = Util.genUri() + '-tr';
                                    }
                                }
                            }

                            const aggregate = rule['v-wf:aggregate'];
                            for (const item of aggregate) {
                                eval(item.data);
                            }

                            if (!grouping) {
                                out_data0[out_data0_el['@']] = out_data0_el;
                            } else {
                                out_data0[group_key] = out_data0_el;
                            }
                        }
                    }
                }
            }
        }

        const out_data = [];
        for (const key in out_data0) {
            if (Object.hasOwnProperty.call(out_data0, key)) {
                out_data.push(out_data0[key]);
            }
        }

        return out_data;
    } catch (e) {
        console.error('Transformation failed');
    }
};
