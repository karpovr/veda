/*
 * Camunda BPM REST API
 *
 * OpenApi Spec for Camunda BPM REST API.
 *
 * The version of the OpenAPI document: 7.14.0
 * 
 * Generated by: https://openapi-generator.tech
 */

use std::rc::Rc;
use std::borrow::Borrow;
#[allow(unused_imports)]
use std::option::Option;

use reqwest;

use super::{Error, configuration};

pub struct MetricsApiClient {
    configuration: Rc<configuration::Configuration>,
}

impl MetricsApiClient {
    pub fn new(configuration: Rc<configuration::Configuration>) -> MetricsApiClient {
        MetricsApiClient {
            configuration,
        }
    }
}

pub trait MetricsApi {
    fn get_metrics(&self, metrics_name: &str, start_date: Option<String>, end_date: Option<String>) -> Result<crate::models::MetricsResultDto, Error>;
    fn interval(&self, name: Option<&str>, reporter: Option<&str>, start_date: Option<String>, end_date: Option<String>, first_result: Option<i32>, max_results: Option<i32>, interval: Option<&str>, aggregate_by_reporter: Option<&str>) -> Result<Vec<crate::models::MetricsIntervalResultDto>, Error>;
}

impl MetricsApi for MetricsApiClient {
    fn get_metrics(&self, metrics_name: &str, start_date: Option<String>, end_date: Option<String>) -> Result<crate::models::MetricsResultDto, Error> {
        let configuration: &configuration::Configuration = self.configuration.borrow();
        let client = &configuration.client;

        let uri_str = format!("{}/metrics/{metrics_name}/sum", configuration.base_path, metrics_name=crate::apis::urlencode(metrics_name));
        let mut req_builder = client.get(uri_str.as_str());

        if let Some(ref s) = start_date {
            req_builder = req_builder.query(&[("startDate", &s.to_string())]);
        }
        if let Some(ref s) = end_date {
            req_builder = req_builder.query(&[("endDate", &s.to_string())]);
        }
        if let Some(ref user_agent) = configuration.user_agent {
            req_builder = req_builder.header(reqwest::header::USER_AGENT, user_agent.clone());
        }

        // send request
        let req = req_builder.build()?;

        Ok(client.execute(req)?.error_for_status()?.json()?)
    }

    fn interval(&self, name: Option<&str>, reporter: Option<&str>, start_date: Option<String>, end_date: Option<String>, first_result: Option<i32>, max_results: Option<i32>, interval: Option<&str>, aggregate_by_reporter: Option<&str>) -> Result<Vec<crate::models::MetricsIntervalResultDto>, Error> {
        let configuration: &configuration::Configuration = self.configuration.borrow();
        let client = &configuration.client;

        let uri_str = format!("{}/metrics", configuration.base_path);
        let mut req_builder = client.get(uri_str.as_str());

        if let Some(ref s) = name {
            req_builder = req_builder.query(&[("name", &s.to_string())]);
        }
        if let Some(ref s) = reporter {
            req_builder = req_builder.query(&[("reporter", &s.to_string())]);
        }
        if let Some(ref s) = start_date {
            req_builder = req_builder.query(&[("startDate", &s.to_string())]);
        }
        if let Some(ref s) = end_date {
            req_builder = req_builder.query(&[("endDate", &s.to_string())]);
        }
        if let Some(ref s) = first_result {
            req_builder = req_builder.query(&[("firstResult", &s.to_string())]);
        }
        if let Some(ref s) = max_results {
            req_builder = req_builder.query(&[("maxResults", &s.to_string())]);
        }
        if let Some(ref s) = interval {
            req_builder = req_builder.query(&[("interval", &s.to_string())]);
        }
        if let Some(ref s) = aggregate_by_reporter {
            req_builder = req_builder.query(&[("aggregateByReporter", &s.to_string())]);
        }
        if let Some(ref user_agent) = configuration.user_agent {
            req_builder = req_builder.header(reqwest::header::USER_AGENT, user_agent.clone());
        }

        // send request
        let req = req_builder.build()?;

        Ok(client.execute(req)?.error_for_status()?.json()?)
    }

}