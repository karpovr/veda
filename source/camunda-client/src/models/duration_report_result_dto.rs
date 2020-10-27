/*
 * Camunda BPM REST API
 *
 * OpenApi Spec for Camunda BPM REST API.
 *
 * The version of the OpenAPI document: 7.14.0
 * 
 * Generated by: https://openapi-generator.tech
 */




#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct DurationReportResultDto {
    /// Specifies a timespan within a year. **Note:** The period must be interpreted in conjunction with the returned `periodUnit`.
    #[serde(rename = "period", skip_serializing_if = "Option::is_none")]
    pub period: Option<i32>,
    /// The unit of the given period. Possible values are `MONTH` and `QUARTER`.
    #[serde(rename = "periodUnit", skip_serializing_if = "Option::is_none")]
    pub period_unit: Option<PeriodUnit>,
    /// The smallest duration in milliseconds of all completed process instances which were started in the given period.
    #[serde(rename = "minimum", skip_serializing_if = "Option::is_none")]
    pub minimum: Option<i64>,
    /// The greatest duration in milliseconds of all completed process instances which were started in the given period.
    #[serde(rename = "maximum", skip_serializing_if = "Option::is_none")]
    pub maximum: Option<i64>,
    /// The average duration in milliseconds of all completed process instances which were started in the given period.
    #[serde(rename = "average", skip_serializing_if = "Option::is_none")]
    pub average: Option<i64>,
}

impl DurationReportResultDto {
    pub fn new() -> DurationReportResultDto {
        DurationReportResultDto {
            period: None,
            period_unit: None,
            minimum: None,
            maximum: None,
            average: None,
        }
    }
}

/// The unit of the given period. Possible values are `MONTH` and `QUARTER`.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Hash, Serialize, Deserialize)]
pub enum PeriodUnit {
    #[serde(rename = "MONTH")]
    MONTH,
    #[serde(rename = "QUARTER")]
    QUARTER,
}
