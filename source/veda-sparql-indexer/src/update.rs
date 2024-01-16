use crate::Context;
use reqwest::StatusCode;
use std::collections::HashMap;
use v_common::module::module_impl::PrepareError;
use v_common::onto::individual::Individual;
use v_common::onto::resource::{Resource, Value};

// Updates the state of an individual in the context of a given system or application.
pub fn update_individual_states(previous_individual: &mut Individual, current_individual: &mut Individual, update_context: &mut Context) -> Result<bool, PrepareError> {
    // Compare the states of the two individuals to identify changes.
    let state_differences = compare_individual_states(&previous_individual, &current_individual);

    // Generate SPARQL queries for updating the RDF store based on the differences.
    let queries = generate_sparql_update_queries(state_differences, current_individual.get_id(), &update_context.prefixes);
    let combined_sparql_queries = queries.join(";\n");

    // Log the generated SPARQL queries for debugging and monitoring.
    info!("{}", combined_sparql_queries);

    // Send the SPARQL update queries to the update endpoint.
    let update_endpoint_url = &update_context.update_point;
    if let Ok(response) = update_context.rt.block_on(update_context.client.post(update_endpoint_url).body(combined_sparql_queries).header("Content-Type", "application/sparql-update").send()) {
        // Check the response status to ensure the update was successful.
        if response.status() == StatusCode::CREATED || response.status() == StatusCode::NO_CONTENT {
        } else {
            // Log an error and return a recoverable error if the update fails.
            error!("{:?}", response);
            return Err(PrepareError::Recoverable);
        }
    }

    Ok(true)
}

// Generates SPARQL queries to reflect the changes between two states of an individual.
fn generate_sparql_update_queries(state_differences: ComparisonResult, individual_uri: &str, prefixes: &HashMap<String, String>) -> Vec<String> {
    let mut sparql_delete_queries = Vec::new();
    let mut sparql_insert_queries = Vec::new();

    // Generate delete queries for each pair that needs to be removed.
    for (predicate, object) in state_differences.pairs_to_remove {
        sparql_delete_queries.push(format!(
            "<{}> <{}> {} .\n",
            expand_shortened_uri(individual_uri, prefixes),
            expand_shortened_uri(&predicate, prefixes),
            format_value_for_sparql(&object.value, prefixes)
        ));
    }

    // Generate insert queries for each pair that needs to be added.
    for (predicate, object) in state_differences.pairs_to_add {
        sparql_insert_queries.push(format!(
            "<{}> <{}> {} .\n",
            expand_shortened_uri(individual_uri, prefixes),
            expand_shortened_uri(&predicate, prefixes),
            format_value_for_sparql(&object.value, prefixes)
        ));
    }

    let mut queries = Vec::new();
    // Combine delete and insert queries.
    if !sparql_delete_queries.is_empty() {
        queries.push(format!("DELETE DATA {{ {} }}", sparql_delete_queries.join(" ")));
    }
    if !sparql_insert_queries.is_empty() {
        queries.push(format!("INSERT DATA {{ {} }}", sparql_insert_queries.join(" ")));
    }

    queries
}

// Expands a shortened URI to its full form using the provided prefixes.
fn expand_shortened_uri(rtype: &str, prefixes: &HashMap<String, String>) -> String {
    let parts: Vec<&str> = rtype.split(':').collect();
    if parts.len() == 2 {
        // Replace the prefix with its full URI form.
        if let Some(prefix_uri) = prefixes.get(parts[0]) {
            return format!("{}{}", prefix_uri, parts[1]);
        }
    }
    // Return the original string if no matching prefix is found.
    rtype.to_string()
}

// Formats a value for inclusion in a SPARQL query.
fn format_value_for_sparql(value: &Value, prefixes: &HashMap<String, String>) -> String {
    match value {
        // Different formats for different types of values.
        Value::Int(i) => i.to_string(),
        Value::Str(s, lang) => {
            if lang.is_some() {
                format!("\"{}\"@{}", s, lang.to_string())
            } else {
                format!("\"{}\"", s)
            }
        },
        Value::Uri(u) => format!("<{}>", expand_shortened_uri(u, prefixes)),
        Value::Bool(b) => b.to_string(),
        Value::Num(num1, num2) => format!("\"{}^^{}\"", num1, num2),
        Value::Binary(vec) => {
            let encoded = base64::encode(vec);
            format!("\"{}\"", encoded)
        },
        Value::Datetime(dt) => {
            // Convert timestamp to a formatted datetime string.
            match chrono::NaiveDateTime::from_timestamp_opt(*dt, 0) {
                Some(datetime) => format!("\"{}\"^^<http://www.w3.org/2001/XMLSchema#dateTime>", datetime.format("%Y-%m-%dT%H:%M:%S")),
                None => String::new(),
            }
        },
    }
}

struct ComparisonResult<'a> {
    pairs_to_add: Vec<(String, &'a Resource)>,
    pairs_to_remove: Vec<(String, &'a Resource)>,
}

// Converts an individual's state into a collection of predicate-object pairs.
fn extract_predicate_object_pairs<'a>(individual: &'a Individual) -> Vec<(String, &'a Resource)> {
    let mut pairs = Vec::new();
    // Iterate over the individual's properties to form pairs.
    for (predicate_uri, resources) in individual.get_obj().get_resources() {
        for resource in resources {
            pairs.push((predicate_uri.clone(), resource));
        }
    }
    pairs
}

// Compares two states of an individual to determine what has changed.
fn compare_individual_states<'a>(previous_individual: &'a Individual, current_individual: &'a Individual) -> ComparisonResult<'a> {
    let prev_pairs = extract_predicate_object_pairs(previous_individual);
    let new_pairs = extract_predicate_object_pairs(current_individual);

    // Determine which pairs are to be added and which are to be removed.
    let pairs_to_add = new_pairs.iter().filter(|p| !prev_pairs.contains(p)).cloned().collect();
    let pairs_to_remove = prev_pairs.iter().filter(|p| !new_pairs.contains(p)).cloned().collect();

    ComparisonResult {
        pairs_to_add,
        pairs_to_remove,
    }
}
