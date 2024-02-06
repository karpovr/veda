use crate::Context;
use reqwest::StatusCode;
use std::collections::HashMap;
use std::io;
use v_common::module::module_impl::PrepareError;
use v_common::onto::datatype::DataType;
use v_common::onto::individual::Individual;
use v_common::onto::individual2turtle::format_resource;
use v_common::onto::resource::Resource;
use v_common::onto::turtle_formatters_with_prefixes::TurtleFormatterWithPrefixes;

// Updates the state of an individual in the context of a given system or application.
pub fn update_individual_states(previous_individual: &mut Individual, current_individual: &mut Individual, update_context: &mut Context) -> Result<bool, PrepareError> {
    // Compare the states of the two individuals to identify changes.
    let state_differences = compare_individual_states(previous_individual, current_individual);

    // Generate SPARQL queries for updating the RDF store based on the differences.
    let combined_sparql_queries = match generate_sparql_update_queries(state_differences, current_individual.get_id(), &update_context.prefixes) {
        Ok(queries) => queries,
        Err(e) => {
            error!("update_individual_states err={:?}", e);
            return Err(PrepareError::Fatal);
        },
    };

    // Log the generated SPARQL queries for debugging and monitoring.
    info!("{}", combined_sparql_queries);

    // Send the SPARQL update queries to the update endpoint.
    let update_endpoint_url = &update_context.update_point;
    if let Ok(response) = update_context
        .rt
        .block_on(update_context.client.post(update_endpoint_url).body(combined_sparql_queries).header("Content-Type", "application/sparql-update").send())
    {
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
fn generate_sparql_update_queries(state_differences: ComparisonResult, individual_uri: &str, all_prefixes: &HashMap<String, String>) -> Result<String, io::Error> {
    let mut used_prefixes = HashMap::new();
    collect_prefix(individual_uri, all_prefixes, &mut used_prefixes);
    collect_prefix("xsd:", all_prefixes, &mut used_prefixes);
    collect_prefixes(&state_differences.pairs_to_remove, all_prefixes, &mut used_prefixes);
    collect_prefixes(&state_differences.pairs_to_add, all_prefixes, &mut used_prefixes);

    let delete = if !state_differences.pairs_to_remove.is_empty() {
        format!("DELETE DATA {{\n {} }} ;\n", String::from_utf8_lossy(&to_turtle(individual_uri, &state_differences.pairs_to_remove, &used_prefixes)?))
    } else {
        String::default()
    };

    let insert = if !state_differences.pairs_to_remove.is_empty() {
        format!("INSERT DATA {{\n {} }}", String::from_utf8_lossy(&to_turtle(individual_uri, &state_differences.pairs_to_add, &used_prefixes)?))
    } else {
        String::default()
    };

    let binding = to_query_prefixes(&used_prefixes)?;
    let prefixes = String::from_utf8_lossy(&binding);

    let query = format!("{}{}{}", prefixes, delete, insert);
    Ok(query)
}

struct ComparisonResult<'a> {
    pairs_to_add: Vec<(String, &'a Resource)>,
    pairs_to_remove: Vec<(String, &'a Resource)>,
}

// Converts an individual's state into a collection of predicate-object pairs.
fn extract_predicate_object_pairs(individual: &Individual) -> Vec<(String, &Resource)> {
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

fn extract_prefix(v: &str) -> Option<&str> {
    if let Some(el) = v.split(':').next() {
        return Some(el);
    }
    None
}

fn collect_prefix(v: &str, all_prefixes: &HashMap<String, String>, used_prefixes: &mut HashMap<String, String>) {
    if let Some(p) = extract_prefix(v) {
        if !used_prefixes.contains_key(p) {
            if let Some(up) = all_prefixes.get(&(p.to_owned())) {
                used_prefixes.insert(p.to_owned(), up.to_owned());
            }
        }
    }
}

fn collect_prefixes(po_vec: &[(String, &Resource)], all_prefixes: &HashMap<String, String>, used_prefixes: &mut HashMap<String, String>) {
    for (p, o) in po_vec.iter() {
        collect_prefix(p, all_prefixes, used_prefixes);
        if let DataType::Uri = o.rtype {
            collect_prefix(o.get_uri(), all_prefixes, used_prefixes);
        }
    }
}

fn to_turtle(id: &str, po_s: &Vec<(String, &Resource)>, used_prefixes: &HashMap<String, String>) -> Result<Vec<u8>, io::Error> {
    let mut formatter = TurtleFormatterWithPrefixes::new(Vec::default(), used_prefixes, false);

    for (predicate, resource) in po_s {
        if predicate == "?" {
            format_resource(id, "d:unknown", resource, &mut formatter)?;
        } else if !predicate.contains(':') {
            format_resource(id, &format!("d:{}", predicate), resource, &mut formatter)?;
        } else {
            format_resource(id, predicate, resource, &mut formatter)?;
        }
    }

    formatter.finish()
}

fn to_query_prefixes(used_prefixes: &HashMap<String, String>) -> Result<Vec<u8>, io::Error> {
    let mut formatter = TurtleFormatterWithPrefixes::new(Vec::default(), used_prefixes, false);
    formatter.write_query_prefixes(used_prefixes)?;
    formatter.finish()
}
