use crate::cleaner::CleanerContext;
use chrono::NaiveDateTime;
use flate2::write::GzEncoder;
use flate2::Compression;
use std::collections::HashMap;
use std::fs::File;
use std::io::Write;
use std::thread;
use std::time::Duration as std_Duration;
use systemstat::{Platform, System};
use v_common::onto::individual::Individual;
use v_common::onto::individual2turtle::to_turtle;
use v_common::v_api::api_client::IndvOp;

pub fn remove(indv: &mut Individual, ctx: &mut CleanerContext) {
    let res = ctx.backend.api.update(&ctx.sys_ticket.id, IndvOp::Remove, &Individual::default().set_id(indv.get_id()));
    info!(
        "remove {}, created = {}, id = {}, result = {:?}",
        indv.get_first_literal("rdf:type").unwrap_or_default(),
        NaiveDateTime::from_timestamp(indv.get_first_datetime("v-s:created").unwrap_or_default(), 0).format("%d.%m.%Y %H:%M:%S"),
        indv.get_id(),
        res
    );
}

pub fn store_to_ttl(indvs: &mut Vec<Individual>, prefixes: &mut HashMap<String, String>, batch_name: &str) {
    if let Ok(buf) = to_turtle(&indvs, prefixes) {
        let mut ze = GzEncoder::new(Vec::new(), Compression::default());

        ze.write_all(format!("# count elements: {}\n", indvs.len()).as_bytes()).unwrap_or_default();
        if let Err(e) = ze.write_all(buf.as_slice()) {
            error!("failed compress, err = {:?}", e);
            return;
        } else {
            if let Ok(compressed_bytes) = ze.finish() {
                let mut file_path = format!("./out/{}.ttl.gz", batch_name);
                let mut fc = 0;
                loop {
                    if !std::path::Path::new(&file_path).exists() {
                        break;
                    }
                    warn!("file {} already exists", file_path);
                    fc += 1;
                    file_path = format!("./out/{}_{}.ttl.gz", batch_name, fc);
                }

                if let Ok(mut file) = File::create(&(file_path)) {
                    if let Err(e) = file.write_all(&compressed_bytes) {
                        error!("failed to write to file {}, {:?}", file_path, e);
                        return;
                    }
                    info!("stored: count = {}, bytes = {}", indvs.len(), buf.len());
                } else {
                    error!("failed to create file {}", file_path);
                    return;
                }
            } else {
                error!("failed compress");
                return;
            }
        }
    }
}

pub fn pause_if_overload(sys: &System, max_load: usize) {
    loop {
        match sys.load_average() {
            Ok(loadavg) => {
                if loadavg.one > max_load as f32 {
                    info!("Load average one: {} > {}, sleep", loadavg.one, max_load);
                    thread::sleep(std_Duration::from_millis(10000));
                } else {
                    break;
                }
            }
            Err(x) => {
                info!("\nLoad average: error: {}", x);
                break;
            }
        }
    }
}

pub fn store_to_file_and_remove_from_storage(mut collected: &mut Vec<Individual>, name: &str, ctx: &mut CleanerContext, pos: i64) {
    if !collected.is_empty() && ctx.operations.contains("to_ttl") {
        store_to_ttl(&mut collected, &mut ctx.onto.prefixes, &format!("{}_{}", name, pos));
    }
    if ctx.operations.contains("remove") {
        for s in collected.iter_mut() {
            remove(s, ctx);
        }
    }

    *collected = Vec::new();
}
