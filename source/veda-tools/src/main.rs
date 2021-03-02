mod cleaner;
mod common;
mod queue_tools;
mod v_s_email;
mod v_s_membership;
mod v_s_membership1;
mod v_s_membership2;
mod v_s_permissionstatement;
mod v_wf_process;

#[macro_use]
extern crate log;

use crate::queue_tools::{export_from_query, queue_to_json, queue_to_veda};
use cleaner::clean;
use type_cli::CLI;
use v_module::module::init_log;

#[derive(CLI)]
#[help = "veda tools"]
enum Tools {
    #[help = "Store individuals from queue to storage"]
    QueueStorage {
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
    QueueJson {
        #[named]
        #[help = "path to queue"]
        queue_path: String,

        #[named]
        #[help = "queue part id"]
        #[optional]
        part_id: Option<u32>,
    },
    #[help = "Build queue from query"]
    QueryQueue(String),

    #[help = "Run cleaner"]
    Cleaner {
        #[named]
        #[help = "name of executing cleaning algorithm"]
        module: String,

        #[named]
        #[help = "operation"]
        operation: String,

        #[named]
        #[help = "type of report"]
        report: String,
    },
}

fn main() {
    init_log("VEDA-TOOLS");

    match Tools::process() {
        Tools::QueryQueue(query) => {
            info!("query={}", query);
            export_from_query(&query).expect("fail create query from queue");
        }
        Tools::Cleaner {
            module,
            operation,
            report,
        } => {
            info!("module={}", module);
            clean(module, operation, report);
        }
        Tools::QueueStorage {
            queue_path,
            part_id,
            check_counter,
        } => {
            info!("queue_path={}, part_id={:?}", queue_path, part_id);
            queue_to_veda(queue_path, part_id, check_counter);
        }
        Tools::QueueJson {
            queue_path,
            part_id,
        } => {
            info!("queue_path={}, part_id={:?}", queue_path, part_id);
            queue_to_json(queue_path, part_id);
        }
    }
}
