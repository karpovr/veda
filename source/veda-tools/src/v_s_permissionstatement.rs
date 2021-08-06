use crate::cleaner::CleanerContext;
use crate::common::{remove, store_to_ttl};
use v_common::module::info::ModuleInfo;
use v_common::onto::individual::Individual;
use v_common::v_api::obj::OptAuthorize;
use v_common::v_api::obj::ResultCode;

const MAX_SIZE_BATCH: i64 = 100000;
const MAX_SIZE_COLLECTED: i64 = 1000;

pub fn clean_invalid_permissionstatement(ctx: &mut CleanerContext) {
    let module_info = ModuleInfo::new("./data", "clean_invalid_permission", true);
    if module_info.is_err() {
        error!("failed to start, err = {:?}", &module_info.err());
        return;
    }
    let mut module_info = module_info.unwrap();

    if let Some((mut pos, _)) = module_info.read_info() {
        let query = "SELECT DISTINCT id FROM veda_tt.`v-s:PermissionStatement` FINAL";
        let res = ctx.ch_client.select(&ctx.sys_ticket.user_uri, &query, MAX_SIZE_BATCH, MAX_SIZE_BATCH, pos, OptAuthorize::NO);
        let mut collected = vec![];

        if res.result_code == ResultCode::Ok {
            for id in res.result.iter() {
                if collected.len() > MAX_SIZE_COLLECTED as usize {
                    if ctx.operations.contains("to_ttl") {
                        store_to_ttl(&mut collected, &mut ctx.onto.prefixes, &format!("permission_statement{}", pos));
                    }

                    if ctx.operations.contains("remove") {
                        for s in collected.iter_mut() {
                            //remove(s, ctx);
                        }
                    }

                    collected = vec![];
                }

                pos += 1;
                let mut indv: Individual = Individual::default();
                if ctx.backend.storage.get_individual(id, &mut indv) {
                    if !(indv.is_exists("v-s:canRead") || indv.is_exists("v-s:canCreate") || indv.is_exists("v-s:canUpdate") || indv.is_exists("v-s:canDelete")) {
                        info!("not found rights field");
                        collected.push(indv);
                        //                        remove(&mut indv, ctx);
                        continue;
                    }

                    for p in ["v-s:permissionObject", "v-s:permissionSubject"].iter() {
                        let link_value = indv.get_first_literal(p).unwrap_or_default();
                        if !ctx.backend.get_individual(&link_value, &mut Individual::default()).is_some() {
                            info!("{}->{}[{}] linked object not exist", id, p, link_value);
                            collected.push(indv);
                            //remove(&mut indv, ctx);
                            break;
                        }
                    }
                }
            }

            if let Err(e) = module_info.put_info(pos, pos) {
                error!("err = {:?}", e);
                return;
            }
        }
    }
}
