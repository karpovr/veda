mod cleaner;
mod common;
mod exec_js_on_query;
mod queue_tools;
mod v_s_email;
mod v_s_membership;
mod v_s_membership1;
mod v_s_membership2;
mod v_s_permissionstatement;
mod v_wf_process;
use crate::exec_js_on_query::exec_js_on_query;

#[macro_use]
extern crate log;

use crate::queue_tools::{export_from_query, queue_crc, queue_to_json, queue_to_veda};
use cleaner::clean;
use type_cli::CLI;
use v_v8::v_common::module::module::init_log;

#[derive(CLI)]
#[help = "veda tools"]
enum Tools {
    #[help = "Execute js script on query result"]
    ExecJsOnQuery {
        #[named]
        #[help = "path to query"]
        path_to_query: String,

        #[named]
        #[help = "path to js"]
        path_to_js: String,
    },
    #[help = "Store individuals from queue to storage"]
    QueueToStorage {
        #[named]
        #[help = "path to queue"]
        queue_path: String,

        #[named]
        #[help = "queue part id"]
        #[optional]
        part_id: Option<u32>,

        #[named]
        #[help = "check v-s:updateCounter"]
        #[flag]
        check_counter: bool,
    },
    #[help = "Print individuals from queue to json"]
    QueueToJson {
        #[named]
        #[help = "path to queue"]
        queue_path: String,

        #[named]
        #[help = "queue part id"]
        #[optional]
        part_id: Option<u32>,
    },
    #[help = "Calculate queue CRC"]
    QueueCrc {
        #[named]
        #[help = "path to queue"]
        queue_path: String,

        #[named]
        #[help = "queue part id"]
        #[optional]
        part_id: Option<u32>,
    },
    #[help = "Build queue from query"]
    QueryToQueue(String),
    #[help = "Run cleaner"]
    StorageCleaner {
        #[named]
        #[help = "name of executing cleaning algorithm"]
        #[optional]
        module: Option<String>,

        #[named]
        #[help = "operation"]
        #[optional]
        operation: Option<String>,

        #[named]
        #[help = "type of report"]
        #[optional]
        report: Option<String>,

        #[named]
        #[help = "date from"]
        #[optional]
        date_from: Option<String>,

        #[named]
        #[help = "date to"]
        #[optional]
        date_to: Option<String>,
    },
}

fn main() {
    init_log("VEDA-TOOLS");

    match Tools::process() {
        Tools::ExecJsOnQuery {
            path_to_query,
            path_to_js,
        } => {
            exec_js_on_query(&path_to_query, &path_to_js);
        }
        Tools::QueryToQueue(query) => {
            info!("query={}", query);
            export_from_query(&query).expect("fail create query from queue");
        }
        Tools::StorageCleaner {
            module,
            operation,
            report,
            date_from,
            date_to,
        } => {
            clean(module, operation, report, date_from, date_to);
        }
        Tools::QueueToStorage {
            queue_path,
            part_id,
            check_counter,
        } => {
            info!("queue_path={}, part_id={:?}", queue_path, part_id);
            queue_to_veda(queue_path, part_id, check_counter);
        }
        Tools::QueueToJson {
            queue_path,
            part_id,
        } => {
            info!("queue_path={}, part_id={:?}", queue_path, part_id);
            queue_to_json(queue_path, part_id);
        }
        Tools::QueueCrc {
            queue_path,
            part_id,
        } => {
            info!("queue_path={}, part_id={:?}", queue_path, part_id);
            queue_crc(queue_path, part_id);
        }
    }
}
