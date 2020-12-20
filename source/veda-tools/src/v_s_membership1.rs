use crate::common::remove;

use crate::cleaner::CleanerContext;
use v_api::app::{OptAuthorize, ResultCode};
use v_module::info::ModuleInfo;
use v_onto::individual::Individual;

const MAX_SIZE_BATCH: i64 = 100000;

pub fn remove_membership1(ctx: &mut CleanerContext) {
    let module_info = ModuleInfo::new("./data", "remove_membership1", true);
    if module_info.is_err() {
        error!("{:?}", &module_info.err());
        return;
    }
    let mut module_info = module_info.unwrap();

    if let Some((mut pos, _)) = module_info.read_info() {
        info!("start remove_membership1, pos={}", pos);
        let query = "SELECT id FROM veda_tt.`v-s:Membership` WHERE v_s_memberOf_str[1] = 'cfg:AllUsersGroup' AND rdfs_comment_str[1] = 'выдан cfg:Event_5' AND v_s_deleted_int[1] = 0";
        let res = ctx.ch_client.select(&ctx.sys_ticket.user_uri, &query, MAX_SIZE_BATCH, MAX_SIZE_BATCH, pos, OptAuthorize::NO);

        if res.result_code == ResultCode::Ok {
            for id in res.result.iter() {
                pos += 1;
                if pos % 1000 == 0 {
                    info!("pos={}", pos);
                }

                let mut indv: Individual = Individual::default();
                if ctx.module.storage.get_individual(id, &mut indv) {
                    if &indv.get_first_literal("rdfs:comment").unwrap_or_default() == "выдан cfg:Event_5"
                        && &indv.get_first_literal("v-s:memberOf").unwrap_or_default() == "cfg:AllUsersGroup"
                    {
                        let resource_id = &indv.get_first_literal("v-s:resource").unwrap_or_default();
                        if let Some(r) = ctx.module.get_individual(resource_id, &mut Individual::default()) {
                            if r.any_exists("rdf:type", &["v-s:Version", "mnd-s:Pass"]) {
                                remove(&mut indv, ctx);
                            }
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
