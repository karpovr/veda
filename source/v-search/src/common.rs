use serde::Serialize;
use v_api::app::ResultCode;

#[derive(Serialize, Debug)]
pub struct QueryResult {
    pub result: Vec<String>,
    pub count: i64,
    pub estimated: i64,
    pub processed: i64,
    pub cursor: i64,
    pub total_time: i64,
    pub query_time: i64,
    pub authorize_time: i64,
    pub result_code: ResultCode,
}

impl Default for QueryResult {
    fn default() -> Self {
        QueryResult {
            result: vec![],
            count: 0,
            estimated: 0,
            processed: 0,
            cursor: 0,
            total_time: 0,
            query_time: 0,
            authorize_time: 0,
            result_code: ResultCode::NotReady,
        }
    }
}

#[derive(Debug)]
pub struct FTQuery {
    pub ticket: String,
    pub user: String,
    pub query: String,
    pub sort: String,
    pub databases: String,
    pub reopen: bool,
    pub top: i32,
    pub limit: i32,
    pub from: i32,
}

impl FTQuery {
    pub fn new_with_user(user: &str, query: &str) -> FTQuery {
        FTQuery {
            ticket: "".to_owned(),
            user: user.to_owned(),
            query: query.to_owned(),
            sort: "".to_owned(),
            databases: "".to_owned(),
            reopen: false,
            top: 10000,
            limit: 10000,
            from: 0,
        }
    }

    pub fn new_with_ticket(ticket: &str, query: &str) -> FTQuery {
        FTQuery {
            ticket: ticket.to_owned(),
            user: "".to_owned(),
            query: query.to_owned(),
            sort: "".to_owned(),
            databases: "".to_owned(),
            reopen: false,
            top: 10000,
            limit: 10000,
            from: 0,
        }
    }

    pub fn as_string(&self) -> String {
        let mut s = String::new();

        if self.ticket.is_empty() {
            s.push_str("[\"UU=");
            s.push_str(&self.user);
        } else {
            s.push_str("[\"");
            s.push_str(&self.ticket);
        }

        s.push_str("\",\"");
        s.push_str(&self.query);
        s.push_str("\",\"");
        s.push_str(&self.sort);
        s.push_str("\",\"");
        s.push_str(&self.databases);
        s.push_str("\",");
        s.push_str(&self.reopen.to_string());
        s.push(',');
        s.push_str(&self.top.to_string());
        s.push(',');
        s.push_str(&self.limit.to_string());
        s.push(',');
        s.push_str(&self.from.to_string());
        s.push(']');

        s
    }
}
