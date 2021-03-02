use crate::cleaner::CleanerContext;
use crate::common::remove;
use v_module::info::ModuleInfo;
use v_module::v_api::app::{OptAuthorize, ResultCode};
use v_module::v_onto::individual::Individual;

const MAX_SIZE_BATCH: i64 = 100000;

pub fn clean_invalid_membership(ctx: &mut CleanerContext) {
    let module_info = ModuleInfo::new("./data", "clean_invalid_membership", true);
    if module_info.is_err() {
        error!("{:?}", &module_info.err());
        return;
    }
    let mut module_info = module_info.unwrap();

    if let Some((mut pos, _)) = module_info.read_info() {
        let query = "SELECT DISTINCT id FROM veda_tt.`v-s:Membership` FINAL WHERE v_s_deleted_int[1] = 0";
        let res = ctx.ch_client.select(&ctx.sys_ticket.user_uri, &query, MAX_SIZE_BATCH, MAX_SIZE_BATCH, pos, OptAuthorize::NO);

        if res.result_code == ResultCode::Ok {
            for id in res.result.iter() {
                pos += 1;
                let mut indv: Individual = Individual::default();
                if ctx.module.storage.get_individual(id, &mut indv) {
                    for p in ["v-s:memberOf", "v-s:resource"].iter() {
                        let link_value = &indv.get_first_literal(p).unwrap_or_default();
                        if !ctx.module.get_individual(link_value, &mut Individual::default()).is_some() {
                            info!("{}->{}[{}] linked object not exist", id, p, link_value);
                            remove(&mut indv, ctx);
                            continue;
                        }
                    }
                }
            }

            if let Err(e) = module_info.put_info(pos, pos) {
                error!("{:?}", e);
                return;
            }
        }
    }
}
