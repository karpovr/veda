/*
 * Camunda BPM REST API
 *
 * OpenApi Spec for Camunda BPM REST API.
 *
 * The version of the OpenAPI document: 7.14.0
 * 
 * Generated by: https://openapi-generator.tech
 */

/// MessageCorrelationResultWithVariableDto : The `processInstance` property only has a value if the resultType is set to `ProcessDefinition`. The processInstance with the properties as described in the [get single instance](https://docs.camunda.org/manual/7.14/reference/rest/process-instance/get/) method.  The `execution` property only has a value if the resultType is set to `Execution`. The execution with the properties as described in the [get single execution](https://docs.camunda.org/manual/7.14/reference/rest/execution/get/) method.



#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct MessageCorrelationResultWithVariableDto {
    /// Indicates if the message was correlated to a message start event or an  intermediate message catching event. In the first case, the resultType is  `ProcessDefinition` and otherwise `Execution`.
    #[serde(rename = "resultType", skip_serializing_if = "Option::is_none")]
    pub result_type: Option<ResultType>,
    #[serde(rename = "processInstance", skip_serializing_if = "Option::is_none")]
    pub process_instance: Option<crate::models::ProcessInstanceDto>,
    #[serde(rename = "execution", skip_serializing_if = "Option::is_none")]
    pub execution: Option<crate::models::ExecutionDto>,
    /// This property is returned if the `variablesInResultEnabled` is set to `true`. Contains a list of the process variables. 
    #[serde(rename = "variables", skip_serializing_if = "Option::is_none")]
    pub variables: Option<::std::collections::HashMap<String, crate::models::VariableValueDto>>,
}

impl MessageCorrelationResultWithVariableDto {
    /// The `processInstance` property only has a value if the resultType is set to `ProcessDefinition`. The processInstance with the properties as described in the [get single instance](https://docs.camunda.org/manual/7.14/reference/rest/process-instance/get/) method.  The `execution` property only has a value if the resultType is set to `Execution`. The execution with the properties as described in the [get single execution](https://docs.camunda.org/manual/7.14/reference/rest/execution/get/) method.
    pub fn new() -> MessageCorrelationResultWithVariableDto {
        MessageCorrelationResultWithVariableDto {
            result_type: None,
            process_instance: None,
            execution: None,
            variables: None,
        }
    }
}

/// Indicates if the message was correlated to a message start event or an  intermediate message catching event. In the first case, the resultType is  `ProcessDefinition` and otherwise `Execution`.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Hash, Serialize, Deserialize)]
pub enum ResultType {
    #[serde(rename = "Execution")]
    Execution,
    #[serde(rename = "ProcessDefinition")]
    ProcessDefinition,
}
