use std::collections::HashMap;
use v_common::module::info::ModuleInfo;
use v_common::onto::individual::Individual;
use v_common::storage::common::{StorageId, VStorage};
use v_common::v_authorization::common::Access;
use v_common::v_authorization::formats::{decode_rec_to_rightset, encode_rightset, update_counters, M_IGNORE_EXCLUSIVE, M_IS_EXCLUSIVE};
use v_common::v_authorization::{Right, RightSet};

struct RightData<'a> {
    resource: &'a [String],
    in_set: &'a [String],
    access: u8,
}

struct AuxData<'a> {
    use_filter: &'a str,
    marker: char,
    is_drop_count: bool,
    prefix: &'a str,
}

pub struct Context {
    pub permission_statement_counter: u32,
    pub membership_counter: u32,
    pub storage: VStorage,
    pub version_of_index_format: u8,
    pub module_info: ModuleInfo,
}

fn get_access_from_individual(state: &mut Individual) -> u8 {
    let mut access = 0;

    if let Some(v) = state.get_first_bool("v-s:canCreate") {
        if v {
            access |= Access::CanCreate as u8;
        } else {
            access |= Access::CantCreate as u8;
        }
    }

    if let Some(v) = state.get_first_bool("v-s:canRead") {
        if v {
            access |= Access::CanRead as u8;
        } else {
            access |= Access::CantRead as u8;
        }
    }

    if let Some(v) = state.get_first_bool("v-s:canUpdate") {
        if v {
            access |= Access::CanUpdate as u8;
        } else {
            access |= Access::CantUpdate as u8;
        }
    }

    if let Some(v) = state.get_first_bool("v-s:canDelete") {
        if v {
            access |= Access::CanDelete as u8;
        } else {
            access |= Access::CantDelete as u8;
        }
    }

    access
}

pub fn index_right_sets(prev_state: &mut Individual, new_state: &mut Individual, prd_rsc: &str, prd_in_set: &str, prefix: &str, default_access: u8, ctx: &mut Context) {
    let mut is_drop_count = false;

    if let Some(b) = new_state.get_first_bool("v-s:dropCount") {
        if new_state.get_first_integer("v-s:updateCounter").unwrap_or(0) > 1 {
            warn!("detected v-s:updateCounter > 1 with v-s:dropCount, skip indexing {}", new_state.get_id());
            return;
        }

        is_drop_count = b;
    }

    let n_is_del = new_state.get_first_bool("v-s:deleted").unwrap_or_default();
    let p_is_del = prev_state.get_first_bool("v-s:deleted").unwrap_or_default();

    let mut n_acs = get_access_from_individual(new_state);
    let mut p_acs = get_access_from_individual(prev_state);

    if n_acs == 0 {
        n_acs = default_access;
    }

    if p_acs == 0 {
        p_acs = default_access;
    }

    let pre_resc = prev_state.get_literals(prd_rsc).unwrap_or_default();
    let pre_in_set = prev_state.get_literals(prd_in_set).unwrap_or_default();

    let use_filter = new_state.get_first_literal("v-s:useFilter").unwrap_or_default();

    let resc = new_state.get_literals(prd_rsc).unwrap_or_default();
    let in_set = new_state.get_literals(prd_in_set).unwrap_or_default();

    let ignr_excl = new_state.get_first_bool("v-s:ignoreExclusive").unwrap_or_default();
    let is_excl = new_state.get_first_bool("v-s:isExclusive").unwrap_or_default();

    let marker = if is_excl {
        M_IS_EXCLUSIVE
    } else if ignr_excl {
        M_IGNORE_EXCLUSIVE
    } else {
        0 as char
    };

    let id = new_state.get_id();

    let new_data = RightData {
        resource: &resc,
        in_set: &in_set,
        access: n_acs,
    };

    let prev_data = RightData {
        resource: &pre_resc,
        in_set: &pre_in_set,
        access: p_acs,
    };

    let aux_data = AuxData {
        use_filter: &use_filter,
        marker,
        is_drop_count,
        prefix,
    };

    if n_is_del && !p_is_del {
        // IS DELETE
        add_or_del_right_sets(id, &new_data, &prev_data, &aux_data, n_is_del, ctx, &mut HashMap::new(), &Cache::None);
    } else if !n_is_del && p_is_del {
        // IS RESTORE
        let mut cache = HashMap::new();
        //if !pre_resc.is_empty() {
        //    add_or_sub_right_sets(id, &use_filter, &pre_resc, &pre_in_set, &vec![], &vec![], marker, p_acs, p_acs, true, prefix, ctx, &mut cache, &Cache::Write);
        //}

        add_or_del_right_sets(id, &new_data, &prev_data, &aux_data, false, ctx, &mut cache, &Cache::Read);
    } else if !n_is_del && !p_is_del {
        // IS UPDATE
        let mut cache = HashMap::new();
        if !pre_resc.is_empty() {
            let empty_data = RightData {
                resource: &[],
                in_set: &[],
                access: p_acs,
            };

            add_or_del_right_sets(id, &prev_data, &empty_data, &aux_data, true, ctx, &mut cache, &Cache::None);
        }

        add_or_del_right_sets(id, &new_data, &prev_data, &aux_data, false, ctx, &mut cache, &Cache::Read);
    }
}

#[derive(PartialEq, Debug)]
enum Cache {
    Write,
    Read,
    None,
}

fn add_or_del_right_sets(
    id: &str,
    new_data: &RightData,
    prev_data: &RightData,
    aux_data: &AuxData,
    is_deleted: bool,
    ctx: &mut Context,
    cache: &mut HashMap<String, String>,
    mode: &Cache,
) {
    let removed_resource = get_disappeared(prev_data.resource, new_data.resource);
    let removed_in_set = get_disappeared(prev_data.in_set, new_data.in_set);

    if is_deleted && new_data.resource.is_empty() && new_data.in_set.is_empty() {
        let t_data = RightData {
            resource: prev_data.resource,
            in_set: prev_data.in_set,
            access: new_data.access,
        };

        update_right_set(id, &t_data, is_deleted, prev_data.access, aux_data, ctx, cache, mode);
    } else {
        update_right_set(id, new_data, is_deleted, prev_data.access, aux_data, ctx, cache, mode);
    }

    if !removed_resource.is_empty() {
        let t_data = RightData {
            resource: &removed_resource,
            in_set: new_data.in_set,
            access: new_data.access,
        };
        update_right_set(id, &t_data, true, prev_data.access, aux_data, ctx, cache, mode);
    }

    if !removed_in_set.is_empty() {
        let t_data = RightData {
            resource: new_data.resource,
            in_set: &removed_in_set,
            access: new_data.access,
        };
        update_right_set(id, &t_data, true, prev_data.access, aux_data, ctx, cache, mode);
    }
}

fn update_right_set(
    source_id: &str,
    new_data: &RightData,
    is_deleted: bool,
    prev_access: u8,
    aux_data: &AuxData,
    ctx: &mut Context,
    cache: &mut HashMap<String, String>,
    mode: &Cache,
) {
    for rs in new_data.resource.iter() {
        let key = aux_data.prefix.to_owned() + aux_data.use_filter + rs;

        debug!("APPLY ACCESS = {}", new_data.access);
        if is_deleted {
            debug!("IS DELETED");
        }

        let mut new_right_set = RightSet::new();

        if let Some(prev_data_str) = cache.get(&key) {
            debug!("PRE(MEM): {} {} {:?}", source_id, rs, prev_data_str);
            decode_rec_to_rightset(prev_data_str, &mut new_right_set);
        } else if let Some(prev_data_str) = ctx.storage.get_value(StorageId::Az, &key) {
            debug!("PRE(STORAGE): {} {} {:?}", source_id, rs, prev_data_str);
            decode_rec_to_rightset(&prev_data_str, &mut new_right_set);
        }

        for in_set_id in new_data.in_set.iter() {
            if let Some(rr) = new_right_set.get_mut(in_set_id) {
                rr.is_deleted = is_deleted;
                rr.marker = aux_data.marker;
                if aux_data.is_drop_count {
                    rr.access = update_counters(&mut rr.counters, prev_access, new_data.access, is_deleted, aux_data.is_drop_count);
                    if rr.access != 0 && !rr.counters.is_empty() {
                        rr.is_deleted = false;
                    }
                } else if is_deleted {
                    rr.access = update_counters(&mut rr.counters, prev_access, rr.access | prev_access, is_deleted, false);
                    if rr.access != 0 && !rr.counters.is_empty() {
                        rr.is_deleted = false;
                    }
                } else {
                    rr.access = update_counters(&mut rr.counters, prev_access, new_data.access, is_deleted, false);
                }
            } else {
                new_right_set.insert(
                    in_set_id.to_string(),
                    Right {
                        id: in_set_id.to_string(),
                        access: new_data.access,
                        marker: aux_data.marker,
                        is_deleted,
                        level: 0,
                        counters: HashMap::default(),
                    },
                );
            }
        }

        let mut new_record = encode_rightset(new_right_set, ctx.version_of_index_format);

        if new_record.is_empty() {
            new_record = "X".to_string();
        }

        if *mode == Cache::Write {
            debug!("NEW(MEM): {} {} {:?}", source_id, rs, new_record);
            cache.insert(key, new_record);
        } else {
            debug!("NEW(STORAGE): {} {} {:?}", source_id, rs, new_record);
            ctx.storage.put_kv(StorageId::Az, &key, &new_record);
        }
    }
}

pub fn get_disappeared(a: &[String], b: &[String]) -> Vec<String> {
    let delta = Vec::new();

    for r_a in a.iter() {
        let mut delta = Vec::new();
        let mut is_found = false;
        for r_b in b.iter() {
            if r_a == r_b {
                is_found = true;
                break;
            }
        }

        if !is_found {
            delta.push(r_a);
        }
    }

    delta
}
