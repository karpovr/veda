use reqwest;

pub struct Configuration {
    pub base_path: String,
    pub user_agent: Option<String>,
    pub client: reqwest::blocking::Client,
    pub basic_auth: Option<BasicAuth>,
    pub oauth_access_token: Option<String>,
    pub bearer_access_token: Option<String>,
    pub api_key: Option<ApiKey>,
}

pub type BasicAuth = (String, Option<String>);

pub struct ApiKey {
    pub prefix: Option<String>,
    pub key: String,
}

impl Configuration {
    pub fn new(url: &str, user: &str, pass: &str) -> Self {
        let ba = (user.to_owned(), Some(pass.to_owned()));
        Configuration {
            base_path: url.to_owned(),
            user_agent: Some("OpenAPI-Generator/771c6a63-9da8-4300-b275-33061d174776/rust".to_owned()),
            client: reqwest::blocking::Client::new(),
            basic_auth: Some(ba),
            oauth_access_token: None,
            bearer_access_token: None,
            api_key: None,
        }
    }
}

impl Default for Configuration {
    fn default() -> Self {
        Configuration {
            base_path: "http://localhost:8734".to_owned(),
            user_agent: Some("OpenAPI-Generator/771c6a63-9da8-4300-b275-33061d174776/rust".to_owned()),
            client: reqwest::blocking::Client::new(),
            basic_auth: None,
            oauth_access_token: None,
            bearer_access_token: None,
            api_key: None,
        }
    }
}
