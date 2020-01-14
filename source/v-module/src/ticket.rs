use chrono::NaiveDateTime;
use v_api::app::ResultCode;
use v_onto::individual::Individual;

#[derive(Debug, Clone)]
pub struct Ticket {
    pub id: String,
    /// Uri пользователя
    pub user_uri: String,
    /// login пользователя
    pub user_login: String,
    /// Код результата, если тикет не валидный != ResultCode.Ok
    pub result: ResultCode,
    /// Дата начала действия тикета
    pub start_time: i64,
    /// Дата окончания действия тикета
    pub end_time: i64,
}

impl Default for Ticket {
    fn default() -> Self {
        Ticket {
            id: String::default(),
            user_uri: String::default(),
            user_login: String::default(),
            result: ResultCode::AuthenticationFailed,
            start_time: 0,
            end_time: 0,
        }
    }
}

impl Ticket {
    pub fn update_from_individual(&mut self, src: &mut Individual) {
        let when = src.get_first_literal("ticket:when");
        let duration = src.get_first_literal("ticket:duration").unwrap_or_default().parse::<i32>().unwrap_or_default();

        self.id = src.get_id().to_owned();
        self.user_uri = src.get_first_literal("ticket:accessor").unwrap_or_default();
        self.user_login = src.get_first_literal("ticket:login").unwrap_or_default();

        if self.user_uri.is_empty() {
            error!("found a session ticket is not complete, the user can not be found.");
        }

        if !self.user_uri.is_empty() && (when.is_none() || duration < 10) {
            error!("found a session ticket is not complete, we believe that the user has not been found.");
            self.user_uri = String::default();
            return;
        }
        let when = when.unwrap();

        if let Ok(t) = NaiveDateTime::parse_from_str(&when, "%Y-%m-%dT%H:%M:%S%.f") {
            self.start_time = t.timestamp();
            self.end_time = self.start_time + duration as i64;
        } else {
            error!("fail parse field [ticket:when] = {}", when);
            self.user_uri = String::default();
        }
    }
}
