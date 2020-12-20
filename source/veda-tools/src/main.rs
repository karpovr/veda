mod cleaner;
mod common;
mod v_s_email;
mod v_s_membership;
mod v_s_membership1;
mod v_s_membership2;
mod v_s_permissionstatement;
mod v_wf_process;

#[macro_use]
extern crate log;

use cleaner::clean;
use type_cli::CLI;
use v_module::module::init_log;

#[derive(CLI)]
#[help = "veda tools"]
enum Tools {
    #[help = "Build queue from query"]
    Query2Queue(String),

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
        Tools::Query2Queue(query) => {
            info!("query={}", query);
        }
        Tools::Cleaner {
            module,
            operation,
            report,
        } => {
            info!("module={}", module);
            clean(module, operation, report);
        }
    }
}
