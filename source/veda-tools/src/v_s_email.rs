use crate::cleaner::CleanerContext;
use chrono::prelude::*;
use std::ops::Sub;
use time::Duration;
use v_module::v_api::app::{OptAuthorize, ResultCode};
use v_module::v_api::IndvOp;
use v_module::v_onto::individual::Individual;

const MAX_SIZE_BATCH: i64 = 100000;

pub fn clean_email(ctx: &mut CleanerContext) {
    let date_before = Utc::now().naive_utc().sub(Duration::days(30));

    let query =
        format!("SELECT DISTINCT id FROM veda_tt.`v-s:Email` FINAL WHERE v_s_deleted_int[1] = 0 AND v_s_created_date[1] < toDateTime ({})", date_before.timestamp());
    let res = ctx.ch_client.select(&ctx.sys_ticket.user_uri, &query, MAX_SIZE_BATCH, MAX_SIZE_BATCH, 0, OptAuthorize::NO);

    if res.result_code == ResultCode::Ok {
        for id in res.result.iter() {
            let mut rindv: Individual = Individual::default();
            if ctx.module.storage.get_individual(id, &mut rindv) {
                if !rindv.is_exists("v-s:creator") {
                    info!(
                        "remove {}, created = {}, id = {}",
                        rindv.get_first_literal("rdf:type").unwrap_or_default(),
                        NaiveDateTime::from_timestamp(rindv.get_first_datetime("v-s:created").unwrap_or_default(), 0).format("%d.%m.%Y %H:%M:%S"),
                        id,
                    );
                    ctx.module.api.update(&ctx.sys_ticket.id, IndvOp::Remove, &Individual::default().set_id(id));
                }
            }
        }
    }
}
