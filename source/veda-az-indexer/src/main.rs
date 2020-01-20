#[macro_use]
extern crate log;

use crate::common::*;
use v_authorization::Access;
use v_module::info::ModuleInfo;
use v_module::module::*;
use v_onto::individual::*;
use v_queue::consumer::*;
use v_storage::storage::*;

mod common;

fn main() -> Result<(), i32> {
    init_log();

    let mut module = Module::default();

    let mut ctx = Context {
        permission_statement_counter: 0,
        membership_counter: 0,
        storage: VStorage::new_lmdb("./data", StorageMode::ReadWrite),
    };

    if ctx.storage.get_value(StorageId::Az, "Pcfg:VedaSystem").is_none() {
        info!("create permission for system account");
        let mut sys_permission = Individual::default();
        sys_permission.set_id("cfg:VedaSystemPermission");
        sys_permission.add_uri("rdf:type", "v-s:PermissionStatement");
        sys_permission.add_bool("v-s:canCreate", true);
        sys_permission.add_uri("v-s:permissionSubject", "cfg:VedaSystem");
        sys_permission.add_uri("v-s:permissionObject", "v-s:AllResourcesGroup");

        prepare_permission_statement(&mut Individual::default(), &mut sys_permission, &mut ctx);
    }

    let module_info = ModuleInfo::new("./data", "acl_preparer", true);
    if module_info.is_err() {
        error!("{:?}", module_info.err());
        return Err(-1);
    }

    //wait_load_ontology();

    let mut queue_consumer = Consumer::new("./data/queue", "az-indexer", "individuals-flow").expect("!!!!!!!!! FAIL QUEUE");

    module.listen_queue(
        &mut queue_consumer,
        &mut module_info.unwrap(),
        &mut ctx,
        &mut (before_batch as fn(&mut Module, &mut Context, batch_size: u32) -> Option<u32>),
        &mut (prepare as fn(&mut Module, &mut ModuleInfo, &mut Context, &mut Individual) -> Result<(), PrepareError>),
        &mut (after_batch as fn(&mut Module, &mut Context, prepared_batch_size: u32)),
    );
    Ok(())
}

fn before_batch(_module: &mut Module, _ctx: &mut Context, _size_batch: u32) -> Option<u32> {
    None
}

fn after_batch(_module: &mut Module, ctx: &mut Context, _prepared_batch_size: u32) {
    if (ctx.permission_statement_counter + ctx.membership_counter) % 100 == 0 {
        info!("count prepared: permissions={}, memberships={}", ctx.permission_statement_counter, ctx.membership_counter);
    }
}

fn prepare(_module: &mut Module, module_info: &mut ModuleInfo, ctx: &mut Context, queue_element: &mut Individual) -> Result<(), PrepareError> {
    let cmd = get_cmd(queue_element);
    if cmd.is_none() {
        error!("cmd is none");
        return Ok(());
    }

    let op_id = queue_element.get_first_integer("op_id").unwrap_or_default();

    let mut prev_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "prev_state", &mut prev_state);

    let mut new_state = Individual::default();
    get_inner_binobj_as_individual(queue_element, "new_state", &mut new_state);

    if new_state.any_exists("rdf:type", &["v-s:PermissionStatement"]) || prev_state.any_exists("rdf:type", &["v-s:PermissionStatement"]) {
        prepare_permission_statement(&mut prev_state, &mut new_state, ctx);
        ctx.permission_statement_counter += 1;
    } else if new_state.any_exists("rdf:type", &["v-s:Membership"]) || prev_state.any_exists("rdf:type", &["v-s:Membership"]) {
        prepare_membership(&mut prev_state, &mut new_state, ctx);
        ctx.membership_counter += 1;
    } else if new_state.any_exists("rdf:type", &["v-s:PermissionFilter"]) || prev_state.any_exists("rdf:type", &["v-s:PermissionFilter"]) {
        prepare_permission_filter(&mut prev_state, &mut new_state, ctx);
    }

    if let Err(e) = module_info.put_info(op_id, op_id) {
        error!("fail write module_info, op_id={}, err={:?}", op_id, e);
        return Err(PrepareError::Fatal);
    }

    Ok(())
}

fn prepare_permission_statement(prev_state: &mut Individual, new_state: &mut Individual, ctx: &mut Context) {
    prepare_right_set(prev_state, new_state, "v-s:permissionObject", "v-s:permissionSubject", PERMISSION_PREFIX, 0, ctx);
}

fn prepare_membership(prev_state: &mut Individual, new_state: &mut Individual, ctx: &mut Context) {
    prepare_right_set(
        prev_state,
        new_state,
        "v-s:resource",
        "v-s:memberOf",
        MEMBERSHIP_PREFIX,
        Access::CanCreate as u8 | Access::CanRead as u8 | Access::CanUpdate as u8 | Access::CanDelete as u8,
        ctx,
    );
}

fn prepare_permission_filter(prev_state: &mut Individual, new_state: &mut Individual, ctx: &mut Context) {
    prepare_right_set(prev_state, new_state, "v-s:permissionObject", "v-s:resource", FILTER_PREFIX, 0, ctx);
}
