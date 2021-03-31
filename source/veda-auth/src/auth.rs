use crate::common::{create_new_credential, get_candidate_users_of_login, remove_secret, set_password, AuthConf, UserStat, EMPTY_SHA256_HASH, N_ITER};
use chrono::Utc;
use data_encoding::HEXLOWER;
use mustache::MapBuilder;
use rand::{thread_rng, Rng};
use ring::pbkdf2;
use std::num::NonZeroU32;
use std::str::from_utf8;
use uuid::Uuid;
use v_ft_xapian::xapian_reader::XapianReader;
use v_module::module::{create_new_ticket, Module};
use v_module::ticket::Ticket;
use v_module::v_api::app::ResultCode;
use v_module::v_api::IndvOp;
use v_module::v_onto::datatype::Lang;
use v_module::v_onto::individual::Individual;

pub(crate) struct AuthWorkPlace<'a> {
    pub conf: &'a AuthConf,
    pub login: &'a str,
    pub password: &'a str,
    pub secret: &'a str,
    pub sys_ticket: &'a str,
    pub xr: &'a mut XapianReader,
    pub module: &'a mut Module,
    pub user_stat: &'a mut UserStat,
    pub stored_password: String,
    pub stored_salt: String,
    pub edited: i64,
    pub credential: &'a mut Individual,
    pub is_permanent: bool,
}

impl<'a> AuthWorkPlace<'a> {
    pub(crate) fn authenticate(&mut self) -> Ticket {
        let mut ticket = Ticket::default();

        info!("authenticate, login = {:?}, password = {:?}, secret = {:?}", self.login, self.password, self.secret);
        info!("login = {:?}, stat = {:?}", self.login, self.user_stat);

        if self.login.is_empty() || self.login.len() < 3 {
            return ticket;
        }

        if !self.secret.is_empty() && self.secret.len() > 5 && self.password == EMPTY_SHA256_HASH {
            ticket.result = ResultCode::EmptyPassword;
            return ticket;
        }

        if self.secret.is_empty() && self.secret.len() > 5 && (self.password.is_empty() || self.password.len() < 64) {
            ticket.result = ResultCode::InvalidPassword;
            return ticket;
        }

        if !self.secret.is_empty() && self.secret != "?" && self.secret.len() < 6 {
            ticket.result = ResultCode::InvalidSecret;
            return ticket;
        }

        if self.user_stat.wrong_count_login >= self.conf.failed_auth_attempts {
            if Utc::now().timestamp() - self.user_stat.last_wrong_login_date < self.conf.failed_auth_lock_period {
                ticket.result = ResultCode::TooManyRequests;
                error!("too many attempts of login");
                return ticket;
            } else {
                self.user_stat.wrong_count_login = 0;
                self.user_stat.last_wrong_login_date = Utc::now().timestamp();
            }
        }

        let candidate_account_ids = get_candidate_users_of_login(self.login, self.module, self.xr);
        if candidate_account_ids.result_code == ResultCode::Ok && candidate_account_ids.count > 0 {
            for account_id in &candidate_account_ids.result {
                if self.prepare_candidate_account(account_id, &mut ticket) {
                    return ticket;
                }
            }
        }

        error!("failed to authenticate, login = {}, password = {}, candidate users = {:?}", self.login, self.password, candidate_account_ids.result);
        ticket.result = ResultCode::AuthenticationFailed;
        ticket
    }

    fn prepare_candidate_account(&mut self, account_id: &str, ticket: &mut Ticket) -> bool {
        if let Some(account) = self.module.get_individual(&account_id, &mut Individual::default()) {
            account.parse_all();

            let user_id = account.get_first_literal("v-s:owner").unwrap_or_default();
            if user_id.is_empty() {
                error!("user id is null, user_indv = {}", account);
                return false;
            }

            let user_login = account.get_first_literal("v-s:login").unwrap_or_default();
            if user_login.is_empty() {
                error!("user login {:?} not equal to requested login {}", user_login, self.login);
                return false;
            }

            if user_login.to_lowercase() != self.login.to_lowercase() {
                error!("user login {} not equal to requested login {}", user_login, self.login);
                return false;
            }

            let mut person = Individual::default();
            if self.module.get_individual(&user_id, &mut person).is_none() {
                error!("user {} not found", user_id);
                return false;
            }

            self.get_credential(account);

            if !self.secret.is_empty() && self.secret.len() > 5 {
                return self.prepare_secret_code(ticket, &person);
            } else {
                let now = Utc::now().naive_utc().timestamp();

                let is_request_new_password = if self.secret == "?" {
                    warn!("request for new password, user = {}", account.get_id());
                    true
                } else if !self.is_permanent && self.conf.pass_lifetime > 0 && self.edited > 0 && now - self.edited > self.conf.pass_lifetime {
                    error!("password is old, lifetime > {} days, user = {}", self.conf.pass_lifetime, account.get_id());
                    true
                } else {
                    false
                };

                if is_request_new_password {
                    let res = self.request_new_password(&mut person, self.edited, account);
                    if res != ResultCode::Ok {
                        ticket.result = res;
                        return true;
                    }
                }

                // ATTEMPT AUTHENTICATION
                if !self.stored_password.is_empty() && !self.password.is_empty() && self.password.len() > 63 && self.verify_password() {
                    create_new_ticket(self.login, &user_id, self.conf.ticket_lifetime, ticket, &mut self.module.storage);
                    self.user_stat.wrong_count_login = 0;
                    self.user_stat.last_wrong_login_date = 0;
                    return true;
                } else {
                    self.user_stat.wrong_count_login += 1;
                    self.user_stat.last_wrong_login_date = Utc::now().timestamp();
                    warn!("request passw not equal with exist, user={}", account.get_id());
                }
            }
            warn!("user {} not pass", account.get_id());
        } else {
            error!("failed to read, uri = {}", &account_id);
        }
        false
    }

    fn prepare_secret_code(&mut self, ticket: &mut Ticket, person: &Individual) -> bool {
        let old_secret = self.credential.get_first_literal("v-s:secret").unwrap_or_default();
        let now = Utc::now().naive_utc().timestamp();

        if old_secret.is_empty() {
            error!("update password: secret not found, user = {}", person.get_id());
            ticket.result = ResultCode::InvalidSecret;
            remove_secret(&mut self.credential, person.get_id(), self.module, self.sys_ticket);
            return false;
        }

        if self.secret != old_secret {
            error!("request for update password: sent secret not equal to request secret {}, user = {}", self.secret, person.get_id());
            ticket.result = ResultCode::InvalidSecret;
            remove_secret(&mut self.credential, person.get_id(), self.module, self.sys_ticket);
            return false;
        }

        let prev_secret_date = self.credential.get_first_datetime("v-s:SecretDateFrom").unwrap_or_default();
        if now - prev_secret_date > self.conf.secret_lifetime {
            ticket.result = ResultCode::SecretExpired;
            error!("request new password, secret expired, login = {}, password = {}, secret = {}", self.login, self.password, self.secret);
            return false;
        }

        if self.stored_password == self.password {
            error!("update password: password equals to previous password, reject, user = {}", person.get_id());
            ticket.result = ResultCode::NewPasswordIsEqualToOld;
            remove_secret(&mut self.credential, person.get_id(), self.module, self.sys_ticket);
            return false;
        }

        if self.password == EMPTY_SHA256_HASH {
            error!("update password: password is empty, reject, user = {}", person.get_id());
            ticket.result = ResultCode::EmptyPassword;
            remove_secret(&mut self.credential, person.get_id(), self.module, self.sys_ticket);
            return false;
        }

        if (now - self.edited > 0) && now - self.edited < self.conf.success_pass_change_lock_period {
            ticket.result = ResultCode::Locked;
            error!("request new password: too many requests, login = {}, password = {}, secret = {}", self.login, self.password, self.secret);
            return false;
        }

        // update password
        set_password(self.credential, &self.password);

        self.credential.set_datetime("v-s:dateFrom", now);
        self.credential.remove("v-s:secret");
        self.credential.remove("v-s:SecretDateFrom");

        let res = self.module.api.update(&self.sys_ticket, IndvOp::Put, &self.credential);
        if res.result != ResultCode::Ok {
            ticket.result = ResultCode::AuthenticationFailed;
            error!("failed to store new password, password = {}, user = {}", self.password, person.get_id());
            return false;
        } else {
            create_new_ticket(self.login, &person.get_id(), self.conf.ticket_lifetime, ticket, &mut self.module.storage);
            self.user_stat.attempt_change_pass = 0;
            info!("updated password, password = {}, user = {}", self.password, person.get_id());
            return true;
        }
    }

    fn verify_password(&mut self) -> bool {
        if self.stored_salt.is_empty() {
            self.stored_password == self.password
        } else {
            let stored_salt = HEXLOWER.decode(self.stored_salt.as_bytes());
            let stored_pass = HEXLOWER.decode(self.stored_password.as_bytes());

            if stored_salt.is_err() || stored_pass.is_err() {
                error!("failed to encode credential");
                return false;
            }

            let n_iter = NonZeroU32::new(N_ITER).unwrap();
            pbkdf2::verify(pbkdf2::PBKDF2_HMAC_SHA512, n_iter, &stored_salt.unwrap(), self.password.as_bytes(), &stored_pass.unwrap()).is_ok()
        }
    }

    fn get_credential(&mut self, account: &mut Individual) {
        if let Some(account_origin) = account.get_first_literal("v-s:authOrigin") {
            if account_origin.to_uppercase() == "AD" {
                return;
            }
        }

        match account.get_first_literal("v-s:usesCredential") {
            Some(uses_credential_uri) => {
                if let Some(_credential) = self.module.get_individual(&uses_credential_uri, &mut self.credential) {
                    _credential.parse_all();
                    self.stored_password = _credential.get_first_literal("v-s:password").unwrap_or_default();
                    self.stored_salt = _credential.get_first_literal("v-s:salt").unwrap_or_default();
                    self.edited = _credential.get_first_datetime("v-s:dateFrom").unwrap_or_default();
                    self.is_permanent = _credential.get_first_bool("v-s:isPermanent").unwrap_or(false);
                } else {
                    error!("failed to read credential {}", uses_credential_uri);
                    create_new_credential(self.sys_ticket, self.module, &mut self.credential, account);
                }
            }
            None => {
                warn!("failed to find credential, create new");
                self.stored_password = account.get_first_literal("v-s:password").unwrap_or_default();

                create_new_credential(self.sys_ticket, self.module, &mut self.credential, account);
            }
        }
    }

    fn request_new_password(&mut self, user: &mut Individual, edited: i64, account: &mut Individual) -> ResultCode {
        let now = Utc::now().naive_utc().timestamp();
        warn!("request new password, login = {}, password = {}, secret = {}", self.login, self.password, self.secret);

        if let Some(account_origin) = account.get_first_literal("v-s:authOrigin") {
            if account_origin != "veda" {
                return ResultCode::ChangePasswordForbidden;
            }
        }

        if (now - edited > 0) && now - edited < self.conf.success_pass_change_lock_period {
            error!("request new password: too many requests, login = {}, password = {}, secret = {}", self.login, self.password, self.secret);
            return ResultCode::Locked;
        }

        if self.user_stat.attempt_change_pass >= self.conf.failed_change_pass_attempts {
            let prev_secret_date = self.credential.get_first_datetime("v-s:SecretDateFrom").unwrap_or_default();
            if now - prev_secret_date < self.conf.failed_pass_change_lock_period {
                self.user_stat.wrong_count_login = self.conf.failed_auth_attempts + 1;
                self.user_stat.last_wrong_login_date = Utc::now().timestamp();
                error!("request new password, to many requests, login = {}, password = {}, secret = {}", self.login, self.password, self.secret);
                return ResultCode::TooManyRequestsChangePassword;
            }

            if now - self.user_stat.last_attempt_change_pass_date < self.conf.failed_pass_change_lock_period {
                error!("too many requests to change password");
                self.user_stat.wrong_count_login = self.conf.failed_auth_attempts + 1;
                self.user_stat.last_wrong_login_date = Utc::now().timestamp();
                return ResultCode::TooManyRequestsChangePassword;
            } else {
                self.user_stat.attempt_change_pass = 0;
            }
        }

        self.user_stat.attempt_change_pass += 1;
        self.user_stat.last_attempt_change_pass_date = Utc::now().timestamp();

        let n_secret = thread_rng().gen_range(100_000, 999_999).to_string();

        self.credential.set_string("v-s:secret", &n_secret, Lang::NONE);
        self.credential.set_datetime("v-s:SecretDateFrom", now);

        let res = self.module.api.update(&self.sys_ticket, IndvOp::Put, &self.credential);
        if res.result != ResultCode::Ok {
            error!("failed to store new secret, user = {}, result = {:?}", user.get_id(), res);
            return ResultCode::InternalServerError;
        }

        if let Some((subject_t_str, body_t_str)) = &self.conf.expired_pass_notification_template {
            let mailbox = account.get_first_literal("v-s:mailbox").unwrap_or_default();

            if !mailbox.is_empty() && mailbox.len() > 3 {
                let app_name = match self.module.get_individual("v-s:vedaInfo", &mut Individual::default()) {
                    Some(app_info) => {
                        app_info.parse_all();
                        app_info.get_first_literal("rdfs:label").unwrap_or("Veda".to_string())
                    }
                    None => "Veda".to_string(),
                };

                user.parse_all();
                let user_name = user.get_first_literal("rdfs:label").unwrap_or(user.get_id().to_string());

                let map = MapBuilder::new().insert_str("app_name", &app_name).insert_str("secret_code", n_secret.clone()).insert_str("user_name", user_name).build();

                let mut subject = vec![];
                if let Ok(t) = mustache::compile_str(subject_t_str) {
                    if let Err(e) = t.render_data(&mut subject, &map) {
                        error!("failed to render subject from template, err = {:?}", e)
                    }
                }

                let mut body = vec![];
                if let Ok(t) = mustache::compile_str(body_t_str) {
                    if let Err(e) = t.render_data(&mut body, &map) {
                        error!("failed to render body from template, err = {:?}", e)
                    }
                }

                let mut mail_with_secret = Individual::default();
                let uuid1 = "d:mail_".to_owned() + &Uuid::new_v4().to_string();
                mail_with_secret.set_id(&uuid1);
                mail_with_secret.add_uri("rdf:type", "v-s:Email");
                mail_with_secret.add_string("v-s:recipientMailbox", &mailbox, Lang::NONE);
                mail_with_secret.add_datetime("v-s:created", now);
                mail_with_secret.add_uri("v-s:creator", "cfg:VedaSystemAppointment");
                mail_with_secret.add_uri("v-wf:from", "cfg:VedaSystemAppointment");
                mail_with_secret.add_string("v-s:subject", from_utf8(subject.as_slice()).unwrap_or_default(), Lang::NONE);
                mail_with_secret.add_string("v-s:messageBody", from_utf8(body.as_slice()).unwrap_or_default(), Lang::NONE);

                let res = self.module.api.update(&self.sys_ticket, IndvOp::Put, &mail_with_secret);
                if res.result != ResultCode::Ok {
                    error!("failed to store email with new secret, user = {}", account.get_id());
                    return ResultCode::AuthenticationFailed;
                } else {
                    info!("send {} new secret {} to mailbox {}, user={}", mail_with_secret.get_id(), n_secret, mailbox, account.get_id())
                }
            } else {
                error!("mailbox not found, user = {}", account.get_id());
            }
        }
        ResultCode::PasswordExpired
    }
}
