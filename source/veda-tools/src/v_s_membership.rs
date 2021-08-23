use crate::cleaner::CleanerContext;
use crate::common::pause_if_overload;
use crate::common::store_to_file_and_remove_from_storage;
use stopwatch::Stopwatch;
use systemstat::{Platform, System};
use v_common::module::info::ModuleInfo;
use v_common::onto::individual::Individual;
use v_common::v_api::obj::OptAuthorize;
use v_common::v_api::obj::ResultCode;

const MAX_SIZE_BATCH: i64 = 1_000_000;
const MAX_SIZE_COLLECTED: i64 = 100;

pub fn clean_invalid_membership(ctx: &mut CleanerContext) {
    let module_info = ModuleInfo::new("./data", "clean_invalid_membership", true);
    if module_info.is_err() {
        error!("failed to start, err = {:?}", &module_info.err());
        return;
    }
    let mut module_info = module_info.unwrap();

    let sys = System::new();
    let max_load = num_cpus::get() / 3;

    if let Some((mut pos, _)) = module_info.read_info() {
        let mut collected = vec![];
        let mut sw = Stopwatch::start_new();
        loop {
            let query = "SELECT DISTINCT id FROM veda_tt.`v-s:Membership` FINAL";
            let res = ctx.ch_client.select(&ctx.sys_ticket.user_uri, &query, MAX_SIZE_BATCH, MAX_SIZE_BATCH, pos, OptAuthorize::NO);

            if res.result_code == ResultCode::Ok {
                if res.result.is_empty() {
                    break;
                }

                for id in res.result.iter() {
                    if collected.len() > MAX_SIZE_COLLECTED as usize {
                        store_to_file_and_remove_from_storage(&mut collected, "membership", ctx, pos);
                    }

                    pos += 1;
                    let mut indv: Individual = Individual::default();
                    if ctx.backend.storage.get_individual(id, &mut indv) {
                        for p in ["v-s:memberOf", "v-s:resource"].iter() {
                            let link_value = indv.get_first_literal(p).unwrap_or_default();
                            if link_value.starts_with("d:") && !ctx.backend.get_individual(&link_value, &mut Individual::default()).is_some() {
                                info!("{}->{}[{}] linked object not exist", id, p, link_value);
                                collected.push(indv);
                                break;
                            }
                        }
                    }
                    if sw.elapsed_ms() > 1000 {
                        pause_if_overload(&sys, max_load);
                        sw = Stopwatch::start_new();
                    }
                }

                if let Err(e) = module_info.put_info(pos, pos) {
                    error!("err = {:?}", e);
                    return;
                }
            }
            store_to_file_and_remove_from_storage(&mut collected, "membership", ctx, pos);
        }
    }
}
