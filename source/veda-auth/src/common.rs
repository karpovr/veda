use data_encoding::HEXLOWER;
use parse_duration::parse;
use regex::Regex;
use ring::rand::SecureRandom;
use ring::{digest, pbkdf2, rand};
use std::num::NonZeroU32;
use v_common::az_impl::common::f_authorize;
use v_common::ft_xapian::xapian_reader::XapianReader;
use v_common::module::module::create_new_ticket;
use v_common::module::ticket::Ticket;
use v_common::module::veda_backend::Backend;
use v_common::onto::datatype::Lang;
use v_common::onto::individual::Individual;
use v_common::search::common::{FTQuery, QueryResult};
use v_common::v_api::api_client::IndvOp;
use v_common::v_api::obj::ResultCode;
use v_common::v_authorization::common::Trace;

pub const EMPTY_SHA256_HASH: &str = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
pub const ALLOW_TRUSTED_GROUP: &str = "cfg:TrustedAuthenticationUserGroup";
const CREDENTIAL_LEN: usize = digest::SHA512_OUTPUT_LEN;
pub const N_ITER: u32 = 100_000;

#[derive(Default, Debug)]
pub(crate) struct UserStat {
    pub wrong_count_login: i32,
    pub last_wrong_login_date: i64,
    pub attempt_change_pass: i32,
    pub last_attempt_change_pass_date: i64,
}

#[derive(Debug)]
pub(crate) struct AuthConf {
    pub failed_auth_attempts: i32,
    pub failed_change_pass_attempts: i32,
    pub failed_auth_lock_period: i64,
    pub failed_pass_change_lock_period: i64,
    pub success_pass_change_lock_period: i64,
    pub ticket_lifetime: i64,
    pub secret_lifetime: i64,
    pub pass_lifetime: i64,
    pub expired_pass_notification_template: Option<(String, String)>,
}

impl Default for AuthConf {
    fn default() -> Self {
        AuthConf {
            failed_auth_attempts: 2,
            failed_change_pass_attempts: 2,
            failed_auth_lock_period: 30 * 60,
            failed_pass_change_lock_period: 30 * 60,
            success_pass_change_lock_period: 24 * 60 * 60,
            ticket_lifetime: 10 * 60 * 60,
            secret_lifetime: 12 * 60 * 60,
            pass_lifetime: 90 * 24 * 60 * 60,
            expired_pass_notification_template: None,
        }
    }
}

pub(crate) fn get_ticket_trusted(
    conf: &AuthConf,
    tr_ticket_id: Option<&str>,
    login: Option<&str>,
    ip: Option<&str>,
    xr: &mut XapianReader,
    module: &mut Backend,
) -> Ticket {
    let tr_ticket_id = tr_ticket_id.unwrap_or_default();
    let mut tr_ticket = module.get_ticket_from_db(tr_ticket_id);

    let login = if let Some(l) = login {
        l
    } else {
        &tr_ticket.user_login
    };
    info!("get_ticket_trusted, login = {}, ticket = {}", login, tr_ticket_id);

    if login.is_empty() || tr_ticket_id.len() < 6 {
        warn!("trusted authenticate: invalid login {} or ticket {}", login, tr_ticket_id);
        return Ticket::default();
    }

    if tr_ticket.result == ResultCode::Ok {
        let mut is_allow_trusted = false;

        let mut trace = Trace {
            acl: &mut String::new(),
            is_acl: false,
            group: &mut String::new(),
            is_group: true,
            info: &mut String::new(),
            is_info: false,
            str_num: 0,
        };

        match f_authorize(&tr_ticket.user_uri, &tr_ticket.user_uri, 15, true, Some(&mut trace)) {
            Ok(_res) => {
                for gr in trace.group.split('\n') {
                    if gr == ALLOW_TRUSTED_GROUP {
                        is_allow_trusted = true;
                        break;
                    }
                }
            }
            Err(e) => error!("failed to get authorization group, user = {}, err = {}", &tr_ticket.user_uri, e),
        }

        let candidate_account_ids = get_candidate_users_of_login(login, module, xr);
        if candidate_account_ids.result_code == ResultCode::Ok && candidate_account_ids.count > 0 {
            for check_account_id in &candidate_account_ids.result {
                if let Some(account) = module.get_individual(check_account_id, &mut Individual::default()) {
                    let check_user_id = account.get_first_literal("v-s:owner").unwrap_or_default();
                    if check_user_id.is_empty() {
                        error!("user id is null, user_indv = {}", account);
                        continue;
                    }

                    let check_user_login = account.get_first_literal("v-s:login").unwrap_or_default();
                    if check_user_login.is_empty() {
                        warn!("user login {:?} not equal request login {}, skip", check_user_login, login);
                        continue;
                    }

                    if check_user_login.to_lowercase() != login.to_lowercase() {
                        warn!("user login {} not equal request login {}, skip", check_user_login, login);
                        continue;
                    }

                    let mut ticket = Ticket::default();
                    if is_allow_trusted || tr_ticket.user_login.to_lowercase() == check_user_login.to_lowercase() {
                        create_new_ticket(login, &check_user_id, ip.unwrap_or_default(), conf.ticket_lifetime, &mut ticket, &mut module.storage);
                        info!("trusted authenticate, result ticket = {:?}", ticket);

                        return ticket;
                    } else {
                        error!("failed trusted authentication: user {} must be a member of group {} or self", tr_ticket.user_uri, ALLOW_TRUSTED_GROUP);
                    }
                } else {
                    warn!("trusted authenticate: account {} not pass, login {}", check_account_id, login);
                }
            }
        } else {
            error!("failed trusted authentication: not found users for login {}", login);
        }
    } else {
        error!("trusted authenticate: problem ticket {}", tr_ticket_id);
    }

    tr_ticket.result = ResultCode::AuthenticationFailed;
    error!("failed trusted authentication, ticket = {}, login = {}", tr_ticket_id, login);

    tr_ticket
}

pub(crate) fn get_candidate_users_of_login(login: &str, module: &mut Backend, xr: &mut XapianReader) -> QueryResult {
    lazy_static! {
        static ref RE: Regex = Regex::new("[-]").unwrap();
    }

    let query = format!("'v-s:login' == '{}'", RE.replace_all(login, " +"));

    xr.query(FTQuery::new_with_user("cfg:VedaSystem", &query), &mut module.storage)
}

pub(crate) fn create_new_credential(systicket: &str, module: &mut Backend, credential: &mut Individual, account: &mut Individual) -> bool {
    let password = account.get_first_literal("v-s:password").unwrap_or_default();

    credential.set_id(&(account.get_id().to_owned() + "-crdt"));
    credential.set_uri("rdf:type", "v-s:Credential");
    set_password(credential, &password);

    let res = module.mstorage_api.update(systicket, IndvOp::Put, credential);
    if res.result != ResultCode::Ok {
        error!("failed to update, uri = {}, result_code = {:?}", credential.get_id(), res.result);
        return false;
    } else {
        info!("create v-s:Credential {}, res = {:?}", credential.get_id(), res);

        account.remove("v-s:password");
        account.set_uri("v-s:usesCredential", credential.get_id());

        let res = module.mstorage_api.update(systicket, IndvOp::Put, account);
        if res.result != ResultCode::Ok {
            error!("failed to update, uri = {}, res = {:?}", account.get_id(), res);
            return false;
        }
        info!("update user {}, res = {:?}", account.get_id(), res);
    }
    true
}

pub(crate) fn set_password(credential: &mut Individual, password: &str) {
    let n_iter = NonZeroU32::new(N_ITER).unwrap();
    let rng = rand::SystemRandom::new();

    let mut salt = [0u8; CREDENTIAL_LEN];
    if let Ok(..) = rng.fill(&mut salt) {
        let mut pbkdf2_hash = [0u8; CREDENTIAL_LEN];
        pbkdf2::derive(pbkdf2::PBKDF2_HMAC_SHA512, n_iter, &salt, password.as_bytes(), &mut pbkdf2_hash);

        debug!("Salt: {}", HEXLOWER.encode(&salt));
        debug!("PBKDF2 hash: {}", HEXLOWER.encode(&pbkdf2_hash));

        credential.set_string("v-s:salt", &HEXLOWER.encode(&salt), Lang::NONE);
        credential.set_string("v-s:password", &HEXLOWER.encode(&pbkdf2_hash), Lang::NONE);
    } else {
        credential.set_string("v-s:password", password, Lang::NONE);
    }
}

pub(crate) fn remove_secret(uses_credential: &mut Individual, person_id: &str, module: &mut Backend, systicket: &str) {
    if uses_credential.get_first_literal("v-s:secret").is_some() {
        uses_credential.remove("v-s:secret");

        let res = module.mstorage_api.update(systicket, IndvOp::Remove, uses_credential);
        if res.result != ResultCode::Ok {
            error!("failed to remove secret code for user, user = {}", person_id);
        }
    }
}

pub(crate) fn read_duration_param(indv: &mut Individual, param: &str) -> Option<std::time::Duration> {
    if let Some(v) = indv.get_first_literal(param) {
        if let Ok(d) = parse(&v) {
            return Some(d);
        } else {
            error!("failed to parse auth param {}", param);
        }
    }
    None
}

pub(crate) fn read_auth_configuration(backend: &mut Backend) -> AuthConf {
    let mut res = AuthConf::default();

    if let Some(mut node) = backend.get_individual_s("cfg:standart_node") {
        if let Some(d) = read_duration_param(&mut node, "cfg:user_password_lifetime") {
            res.pass_lifetime = d.as_secs() as i64;
        }
        if let Some(d) = read_duration_param(&mut node, "cfg:user_ticket_lifetime") {
            res.ticket_lifetime = d.as_secs() as i64;
        }
        if let Some(d) = read_duration_param(&mut node, "cfg:secret_lifetime") {
            res.secret_lifetime = d.as_secs() as i64;
        }
        if let Some(d) = read_duration_param(&mut node, "cfg:failed_pass_change_lock_period") {
            res.failed_pass_change_lock_period = d.as_secs() as i64;
        }
        if let Some(d) = read_duration_param(&mut node, "cfg:success_pass_change_lock_period") {
            res.success_pass_change_lock_period = d.as_secs() as i64;
        }
        if let Some(d) = read_duration_param(&mut node, "cfg:failed_auth_lock_period") {
            res.failed_auth_lock_period = d.as_secs() as i64;
        }
        if let Some(v) = node.get_first_integer("cfg:failed_auth_attempts") {
            res.failed_auth_attempts = v as i32;
        }
        if let Some(v) = node.get_first_integer("cfg:failed_change_pass_attempts") {
            res.failed_change_pass_attempts = v as i32;
        }

        if let Some(v) = node.get_first_literal("cfg:expired_pass_notification_template") {
            if let Some(mut i) = backend.get_individual_s(&v) {
                if let Some(ss) = i.get_first_literal("v-s:notificationSubject") {
                    if let Some(sb) = i.get_first_literal("v-s:notificationBody") {
                        res.expired_pass_notification_template = Some((ss, sb));
                    }
                }
            }
        }
    }

    info!("read configuration: {:?}", res);

    res
}
