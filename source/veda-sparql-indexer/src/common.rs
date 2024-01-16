use crate::Context;
use bincode::deserialize_from;
use std::collections::HashMap;
use std::fs::File;
use std::io::{Error, ErrorKind};
use std::path::Path;
use v_common::onto::individual::Individual;

pub fn load_map_of_types(path: &str) -> Result<HashMap<u16, String>, Error> {
    let map_file_name = format!("{}/map-rdf-types.bin", path);

    if !Path::new(&map_file_name).exists() {
        warn!("map-rdf-types.bin not exists");
        return Ok(HashMap::new());
    }

    // Open the RDF types map file
    let file = File::open(&map_file_name).map_err(|e| Error::new(e.kind(), format!("Не удалось открыть файл {}: {}", map_file_name, e)))?;

    // Deserialize the RDF types map from the file
    let map_rdf_types: HashMap<String, u16> =
        deserialize_from(&file).map_err(|e| Error::new(ErrorKind::InvalidData, format!("Не удалось десериализовать данные из файла {}: {}", map_file_name, e)))?;

    info!("success load map of rdf types, size={}", map_rdf_types.len());

    Ok(map_rdf_types.into_iter().map(|(k, v)| (v, k)).collect())
}

pub fn is_exportable(in_classes: Option<Vec<String>>, ctx: &mut Context) -> bool {
    if let Some(classes) = in_classes {
        for class in &classes {
            if ctx.onto.is_some_entered(class, &["v-s:Exportable"]) {
                return true;
            }
        }
    }
    false
}

pub fn update_prefix(ctx: &mut Context, rindv: &mut Individual) -> bool {
    if rindv.any_exists("rdf:type", &["owl:Ontology"]) {
        if let Some(full_url) = rindv.get_first_literal("v-s:fullUrl") {
            warn!("prefix : {} -> {}", rindv.get_id(), full_url);
            let short_prefix = rindv.get_id().trim_end_matches(':');
            ctx.prefixes.insert(short_prefix.to_owned(), full_url);
            return true;
        }
    }
    false
}
