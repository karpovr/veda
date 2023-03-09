use crate::common::{create_new_credential, create_new_ticket, get_candidate_users_of_login, remove_secret, set_password, AuthConf, UserStat, EMPTY_SHA256_HASH, N_ITER};
use chrono::Utc;
use data_encoding::HEXLOWER;
use mustache::MapBuilder;
use rand::{thread_rng, Rng};
use ring::pbkdf2;
use std::num::NonZeroU32;
use std::str::from_utf8;
use uuid::Uuid;
use v_common::ft_xapian::xapian_reader::XapianReader;
use v_common::module::ticket::Ticket;
use v_common::module::veda_backend::Backend;
use v_common::onto::datatype::Lang;
use v_common::onto::individual::Individual;
use v_common::storage::common::VStorage;
use v_common::v_api::api_client::IndvOp;
use v_common::v_api::obj::ResultCode;

pub(crate) struct AuthWorkPlace<'a> {
    pub conf: &'a AuthConf,
    pub login: &'a str,
    pub password: &'a str,
    pub ip: &'a str,
    pub secret: &'a str,
    pub sys_ticket: &'a str,
    pub xr: &'a mut XapianReader,
    pub backend: &'a mut Backend,
    pub backup_storage: &'a mut VStorage,
    pub auth_data: &'a mut VStorage,
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

        let candidate_account_ids = get_candidate_users_of_login(self.login, self.backend, self.xr, self.auth_data);
        if candidate_account_ids.result_code == ResultCode::Ok && !candidate_account_ids.result.is_empty() {
            for account_id in &candidate_account_ids.result {
                let (op, res) = self.prepare_candidate_account(account_id, &mut ticket);
                if op && res == ResultCode::Ok || res != ResultCode::Ok {
                    ticket.result = res;
                    return ticket;
                }
            }
        }
        if candidate_account_ids.result_code != ResultCode::Ok {
            error!("authenticate:,= query result={:?}", candidate_account_ids.result_code);
        }

        error!("failed to authenticate: login = {}, password = {}, candidate users = {:?}", self.login, self.password, candidate_account_ids.result);
        ticket.result = ResultCode::AuthenticationFailed;
        ticket
    }

    fn prepare_candidate_account(&mut self, account_id: &str, ticket: &mut Ticket) -> (bool, ResultCode) {
        if let Some(mut account) = self.backend.get_individual_s(account_id) {
            if account.is_exists_bool("v-s:deleted", true) || account.is_exists_bool("v-s:disabled", true) {
                error!("user deleted or disabled, user_id = {}", account.get_id());
                return (false, ResultCode::Ok);
            }

            account.parse_all();

            let user_id = account.get_first_literal("v-s:owner").unwrap_or_default();
            if user_id.is_empty() {
                error!("user id is null, user_indv = {}", account);
                return (false, ResultCode::Ok);
            }

            let user_login = account.get_first_literal("v-s:login").unwrap_or_default();
            if user_login.is_empty() {
                error!("user login {:?} not equal to requested login {}", user_login, self.login);
                return (false, ResultCode::Ok);
            }

            if user_login.to_lowercase() != self.login.to_lowercase() {
                error!("user login {} not equal to requested login {}", user_login, self.login);
                return (false, ResultCode::Ok);
            }

            if let Some(mut person) = self.backend.get_individual_s(&user_id) {
                self.get_credential(&mut account);

                if !self.secret.is_empty() && self.secret.len() > 5 {
                    let res = self.prepare_secret_code(ticket, &person);
                    return if res != ResultCode::Ok {
                        (false, res)
                    } else {
                        (true, ResultCode::Ok)
                    };
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
                        let res = self.request_new_password(&mut person, self.edited, &mut account);
                        if res != ResultCode::Ok {
                            //                            ticket.result = res;
                            return (true, res);
                        }
                    }

                    // ATTEMPT AUTHENTICATION
                    if !self.stored_password.is_empty() && !self.password.is_empty() && self.password.len() > 63 && self.verify_password() {
                        let addr = if self.conf.check_ticket_ip {
                            self.ip
                        } else {
                            "127.0.0.1"
                        };

                        create_new_ticket(self.login, &user_id, addr, self.conf.ticket_lifetime, ticket, &mut self.backend.storage, self.backup_storage);
                        self.user_stat.wrong_count_login = 0;
                        self.user_stat.last_wrong_login_date = 0;
                        return (true, ResultCode::Ok);
                    } else {
                        self.user_stat.wrong_count_login += 1;
                        self.user_stat.last_wrong_login_date = Utc::now().timestamp();
                        warn!("request passw not equal with exist, user={}", account.get_id());
                    }
                }
            } else {
                error!("user {} not found", user_id);
                return (false, ResultCode::Ok);
            }

            warn!("user {} not pass", account.get_id());
        } else {
            error!("failed to read, uri = {}", &account_id);
        }
        (false, ResultCode::Ok)
    }

    fn prepare_secret_code(&mut self, ticket: &mut Ticket, person: &Individual) -> ResultCode {
        let old_secret = self.credential.get_first_literal("v-s:secret").unwrap_or_default();
        let now = Utc::now().naive_utc().timestamp();

        if old_secret.is_empty() {
            error!("update password: secret not found, user = {}", person.get_id());
            remove_secret(self.credential, person.get_id(), self.backend, self.sys_ticket);
            return ResultCode::InvalidSecret;
        }

        if self.secret != old_secret {
            error!("request for update password: sent secret not equal to request secret {}, user = {}", self.secret, person.get_id());
            remove_secret(self.credential, person.get_id(), self.backend, self.sys_ticket);
            return ResultCode::InvalidSecret;
        }

        let prev_secret_date = self.credential.get_first_datetime("v-s:SecretDateFrom").unwrap_or_default();
        if now - prev_secret_date > self.conf.secret_lifetime {
            error!("request new password, secret expired, login = {}, password = {}, secret = {}", self.login, self.password, self.secret);
            return ResultCode::SecretExpired;
        }

        if self.verify_password() {
            error!("update password: password equals to previous password, reject, user = {}", person.get_id());
            remove_secret(self.credential, person.get_id(), self.backend, self.sys_ticket);
            return ResultCode::NewPasswordIsEqualToOld;
        }

        if self.password == EMPTY_SHA256_HASH {
            error!("update password: password is empty, reject, user = {}", person.get_id());
            remove_secret(self.credential, person.get_id(), self.backend, self.sys_ticket);
            return ResultCode::EmptyPassword;
        }

        if (now - self.edited > 0) && now - self.edited < self.conf.success_pass_change_lock_period {
            error!("request new password: too many requests, login = {}, password = {}, secret = {}", self.login, self.password, self.secret);
            return ResultCode::Locked;
        }

        // update password
        set_password(self.credential, self.password);

        self.credential.set_datetime("v-s:dateFrom", now);
        self.credential.remove("v-s:secret");
        self.credential.remove("v-s:SecretDateFrom");

        let res = self.backend.mstorage_api.update(self.sys_ticket, IndvOp::Put, self.credential);
        if res.result == ResultCode::Ok {
            let addr = if self.conf.check_ticket_ip {
                self.ip
            } else {
                "127.0.0.1"
            };

            create_new_ticket(self.login, person.get_id(), addr, self.conf.ticket_lifetime, ticket, &mut self.backend.storage, self.backup_storage);
            self.user_stat.attempt_change_pass = 0;
            info!("updated password, password = {}, user = {}", self.password, person.get_id());
            ResultCode::Ok
        } else {
            error!("failed to store new password, password = {}, user = {}", self.password, person.get_id());
            ResultCode::AuthenticationFailed
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
                if let Some(t_credential) = self.backend.get_individual(&uses_credential_uri, self.credential) {
                    t_credential.parse_all();
                    self.stored_password = t_credential.get_first_literal("v-s:password").unwrap_or_default();
                    self.stored_salt = t_credential.get_first_literal("v-s:salt").unwrap_or_default();
                    self.edited = t_credential.get_first_datetime("v-s:dateFrom").unwrap_or_default();
                    self.is_permanent = t_credential.get_first_bool("v-s:isPermanent").unwrap_or(false);
                } else {
                    error!("failed to read credential {}", uses_credential_uri);
                    create_new_credential(self.sys_ticket, self.backend, self.credential, account);
                }
            },
            None => {
                warn!("failed to find credential, create new");
                self.stored_password = account.get_first_literal("v-s:password").unwrap_or_default();

                create_new_credential(self.sys_ticket, self.backend, self.credential, account);
            },
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

        self.credential.set_string("v-s:secret", &n_secret, Lang::none());
        self.credential.set_datetime("v-s:SecretDateFrom", now);

        let res = self.backend.mstorage_api.update(self.sys_ticket, IndvOp::Put, self.credential);
        if res.result != ResultCode::Ok {
            error!("failed to store new secret, user = {}, result = {:?}", user.get_id(), res);
            return ResultCode::InternalServerError;
        }

        if let Some((subject_t_str, body_t_str)) = &self.conf.expired_pass_notification_template {
            let mailbox = account.get_first_literal("v-s:mailbox").unwrap_or_default();

            if !mailbox.is_empty() && mailbox.len() > 3 {
                let app_name = match self.backend.get_individual_s("v-s:vedaInfo") {
                    Some(mut app_info) => {
                        app_info.parse_all();
                        app_info.get_first_literal("rdfs:label").unwrap_or_else(|| "Veda".to_string())
                    },
                    None => "Veda".to_string(),
                };

                user.parse_all();
                let user_name = user.get_first_literal("rdfs:label").unwrap_or_else(|| user.get_id().to_string());

                let map = MapBuilder::new().insert_str("app_name", app_name).insert_str("secret_code", n_secret.clone()).insert_str("user_name", user_name).build();

                let mut subject = vec![];
                if let Ok(t) = mustache::compile_str(subject_t_str) {
                    if let Err(e) = t.render_data(&mut subject, &map) {
                        error!("failed to render subject from template, err = {:?}", e);
                    }
                }

                let mut body = vec![];
                if let Ok(t) = mustache::compile_str(body_t_str) {
                    if let Err(e) = t.render_data(&mut body, &map) {
                        error!("failed to render body from template, err = {:?}", e);
                    }
                }

                let mut mail_with_secret = Individual::default();
                let uuid1 = "d:mail_".to_owned() + &Uuid::new_v4().to_string();
                mail_with_secret.set_id(&uuid1);
                mail_with_secret.add_uri("rdf:type", "v-s:Email");
                mail_with_secret.add_string("v-s:recipientMailbox", &mailbox, Lang::none());
                mail_with_secret.add_datetime("v-s:created", now);
                mail_with_secret.add_uri("v-s:creator", "cfg:VedaSystemAppointment");
                mail_with_secret.add_uri("v-wf:from", "cfg:VedaSystemAppointment");
                mail_with_secret.add_string("v-s:subject", from_utf8(subject.as_slice()).unwrap_or_default(), Lang::none());
                mail_with_secret.add_string("v-s:messageBody", from_utf8(body.as_slice()).unwrap_or_default(), Lang::none());

                let res = self.backend.mstorage_api.update(self.sys_ticket, IndvOp::Put, &mail_with_secret);
                if res.result != ResultCode::Ok {
                    error!("failed to store email with new secret, user = {}", account.get_id());
                    return ResultCode::AuthenticationFailed;
                } else {
                    info!("send {} new secret {} to mailbox {}, user={}", mail_with_secret.get_id(), n_secret, mailbox, account.get_id());
                }
            } else {
                error!("mailbox not found, user = {}", account.get_id());
            }
        }
        ResultCode::PasswordExpired
    }
}
