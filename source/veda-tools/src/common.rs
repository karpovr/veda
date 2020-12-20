use crate::cleaner::CleanerContext;
use chrono::NaiveDateTime;
use v_api::IndvOp;
use v_onto::individual::Individual;

pub fn remove(indv: &mut Individual, ctx: &mut CleanerContext) {
    let res = ctx.module.api.update(&ctx.sys_ticket.id, IndvOp::Remove, &Individual::default().set_id(indv.get_id()));
    info!(
        "remove {}, created = {}, id = {}, result={:?}",
        indv.get_first_literal("rdf:type").unwrap_or_default(),
        NaiveDateTime::from_timestamp(indv.get_first_datetime("v-s:created").unwrap_or_default(), 0).format("%d.%m.%Y %H:%M:%S"),
        indv.get_id(),
        res
    );
}
