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

pub struct VersionApiClient {
    configuration: Rc<configuration::Configuration>,
}

impl VersionApiClient {
    pub fn new(configuration: Rc<configuration::Configuration>) -> VersionApiClient {
        VersionApiClient {
            configuration,
        }
    }
}

pub trait VersionApi {
    fn get_rest_api_version(&self, ) -> Result<crate::models::VersionDto, Error>;
}

impl VersionApi for VersionApiClient {
    fn get_rest_api_version(&self, ) -> Result<crate::models::VersionDto, Error> {
        let configuration: &configuration::Configuration = self.configuration.borrow();
        let client = &configuration.client;

        let uri_str = format!("{}/version", configuration.base_path);
        let mut req_builder = client.get(uri_str.as_str());

        if let Some(ref user_agent) = configuration.user_agent {
            req_builder = req_builder.header(reqwest::header::USER_AGENT, user_agent.clone());
        }

        // send request
        let req = req_builder.build()?;

        Ok(client.execute(req)?.error_for_status()?.json()?)
    }

}