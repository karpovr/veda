use crate::Context;
use reqwest::StatusCode;
use std::collections::HashMap;
use v_common::module::module_impl::PrepareError;
use v_common::onto::individual::Individual;
use v_common::onto::resource::{Resource, Value};

pub fn update(prev_state: &mut Individual, new_state: &mut Individual, ctx: &mut Context) -> Result<bool, PrepareError> {
    let comparison_result = compare_individuals(&prev_state, &new_state);
    let query = generate_sparql_queries(comparison_result, new_state.get_id(), &ctx.prefixes);
    let query_string = query.join(";\n");

    info!("{}", query_string);

    let url = &ctx.update_point;

    if let Ok(res) = ctx.rt.block_on(ctx.client.post(url).body(query_string).header("Content-Type", "application/sparql-update").send()) {
        if res.status() == StatusCode::CREATED || res.status() == StatusCode::NO_CONTENT {
        } else {
            error!("{:?}", res);
            return Err(PrepareError::Recoverable);
        }
    }

    Ok(true)
}

fn generate_sparql_queries(comparison_result: ComparisonResult, individual_uri: &str, prefixes: &HashMap<String, String>) -> Vec<String> {
    let mut delete_queries = Vec::new();
    let mut insert_queries = Vec::new();

    for (predicate, object) in comparison_result.to_remove {
        delete_queries.push(format!(
            "<{}> <{}> {} .\n",
            unfold_short_prefix(individual_uri, prefixes),
            unfold_short_prefix(&predicate, prefixes),
            format_resource_value(&object.value, prefixes)
        ));
    }
    for (predicate, object) in comparison_result.to_add {
        insert_queries.push(format!(
            "<{}> <{}> {} .\n",
            unfold_short_prefix(individual_uri, prefixes),
            unfold_short_prefix(&predicate, prefixes),
            format_resource_value(&object.value, prefixes)
        ));
    }

    let mut queries = Vec::new();
    if !delete_queries.is_empty() {
        queries.push(format!("DELETE DATA {{ {} }}", delete_queries.join(" ")));
    }
    if !insert_queries.is_empty() {
        queries.push(format!("INSERT DATA {{ {} }}", insert_queries.join(" ")));
    }

    queries
}

fn unfold_short_prefix(rtype: &str, prefixes: &HashMap<String, String>) -> String {
    let parts: Vec<&str> = rtype.split(':').collect();
    if parts.len() == 2 {
        if let Some(prefix_uri) = prefixes.get(parts[0]) {
            return format!("{}{}", prefix_uri, parts[1]);
        }
    }
    rtype.to_string() // Возвращаем исходное значение, если не нашли префикс
}

fn format_resource_value(value: &Value, prefixes: &HashMap<String, String>) -> String {
    match value {
        Value::Int(i) => i.to_string(),
        Value::Str(s, lang) => {
            if lang.is_some() {
                format!("\"{}\"@{}", s, lang.to_string())
            } else {
                format!("\"{}\"", s)
            }
        },
        Value::Uri(u) => format!("<{}>", unfold_short_prefix(u, prefixes)),
        Value::Bool(b) => b.to_string(),
        Value::Num(num1, num2) => format!("\"{}^^{}\"", num1, num2),
        Value::Binary(vec) => {
            let encoded = base64::encode(vec);
            format!("\"{}\"", encoded)
        },
        Value::Datetime(dt) => {
            match chrono::NaiveDateTime::from_timestamp_opt(*dt, 0) {
                Some(datetime) => format!("\"{}\"^^<http://www.w3.org/2001/XMLSchema#dateTime>", datetime.format("%Y-%m-%dT%H:%M:%S")),
                None => String::new(), // В случае некорректного timestamp
            }
        },
    }
}

// Структура для хранения результатов сравнения
struct ComparisonResult<'a> {
    to_add: Vec<(String, &'a Resource)>,
    to_remove: Vec<(String, &'a Resource)>,
}

// Функция для преобразования индивида в массив пар (предикат, объект)
fn individual_to_pairs<'a>(individual: &'a Individual) -> Vec<(String, &'a Resource)> {
    let mut pairs = Vec::new();
    for (predicate_uri, resources) in individual.get_obj().get_resources() {
        for resource in resources {
            let predicate = predicate_uri.clone();
            pairs.push((predicate, resource));
        }
    }
    pairs
}

// Функция для сравнения индивидов
fn compare_individuals<'a>(prev_state: &'a Individual, new_state: &'a Individual) -> ComparisonResult<'a> {
    let prev_pairs = individual_to_pairs(prev_state);
    let new_pairs = individual_to_pairs(new_state);

    let to_add = new_pairs.iter().filter(|p| !prev_pairs.contains(p)).cloned().collect();
    let to_remove = prev_pairs.iter().filter(|p| !new_pairs.contains(p)).cloned().collect();

    ComparisonResult {
        to_add,
        to_remove,
    }
}
