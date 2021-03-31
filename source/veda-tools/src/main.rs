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
    #[help = "Build queue from query"]
    QueryToQueue(String),

    #[help = "Run cleaner"]
    StorageCleaner {
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
        Tools::QueryToQueue(query) => {
            info!("query = {}", query);
            export_from_query(&query).expect("failed to create query from queue");
        }
        Tools::StorageCleaner {
            module,
            operation,
            report,
        } => {
            info!("module = {}", module);
            clean(module, operation, report);
        }
        Tools::QueueToStorage {
            queue_path,
            part_id,
            check_counter,
        } => {
            info!("queue_path = {}, part_id = {:?}", queue_path, part_id);
            queue_to_veda(queue_path, part_id, check_counter);
        }
        Tools::QueueToJson {
            queue_path,
            part_id,
        } => {
            info!("queue_path = {}, part_id = {:?}", queue_path, part_id);
            queue_to_json(queue_path, part_id);
        }
    }
}
