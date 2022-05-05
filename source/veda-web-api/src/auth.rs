use crate::common::{extract_addr, AuthenticateRequest, GetTicketTrustedRequest, TicketRequest, TicketUriRequest, UserInfo};
use crate::common::{get_user_info, log};
use actix_web::http::StatusCode;
use actix_web::{get, HttpRequest};
use actix_web::{web, HttpResponse};
use futures::lock::Mutex;
use std::io;
use std::net::IpAddr;
use std::time::Instant;
use v_common::az_impl::az_lmdb::LmdbAzContext;
use v_common::onto::datatype::Lang;
use v_common::onto::individual::Individual;
use v_common::storage::async_storage::{check_ticket, AStorage, TicketCache};
use v_common::v_api::api_client::AuthClient;
use v_common::v_api::obj::ResultCode;
use v_common::v_authorization::common::{Access, AuthorizationContext, Trace, ACCESS_8_LIST, ACCESS_PREDICATE_LIST};

#[get("get_ticket_trusted")]
pub(crate) async fn get_ticket_trusted(
    req: HttpRequest,
    params: web::Query<GetTicketTrustedRequest>,
    ticket_cache: web::Data<TicketCache>,
    tt: web::Data<AStorage>,
    auth: web::Data<Mutex<AuthClient>>,
) -> io::Result<HttpResponse> {
    let start_time = Instant::now();
    let uinf = UserInfo {
        ticket: None,
        addr: extract_addr(&req),
        user_id: "".to_string(),
    };

    if let Err(e) = check_ticket(&Some(params.ticket.clone()), &ticket_cache, &uinf.addr, &tt).await {
        log(Some(&start_time), &uinf, "get_ticket_trusted", &format!("login={:?}, ip={:?}", params.login, params.ip), e);
        return Ok(HttpResponse::new(StatusCode::from_u16(e as u16).unwrap()));
    }

    let user_addr = if let Some(ip) = &params.ip {
        if let Ok(i) = ip.parse::<IpAddr>() {
            Some(i)
        } else {
            None
        }
    } else {
        uinf.addr
    };

    return match auth.lock().await.get_ticket_trusted(&params.ticket, params.login.as_ref(), user_addr) {
        Ok(r) => {
            log(Some(&start_time), &uinf, "get_ticket_trusted", &format!("login={:?}, ip={:?}", params.login, params.ip), ResultCode::Ok);
            Ok(HttpResponse::Ok().json(r))
        },
        Err(e) => {
            log(Some(&start_time), &uinf, "get_ticket_trusted", &format!("login={:?}, ip={:?}", params.login, params.ip), e.result);
            Ok(HttpResponse::new(StatusCode::from_u16(e.result as u16).unwrap()))
        },
    };
}

#[get("/is_ticket_valid")]
pub(crate) async fn is_ticket_valid(
    params: web::Query<TicketRequest>,
    ticket_cache: web::Data<TicketCache>,
    tt: web::Data<AStorage>,
    req: HttpRequest,
) -> io::Result<HttpResponse> {
    let start_time = Instant::now();
    let uinf = UserInfo {
        ticket: None,
        addr: extract_addr(&req),
        user_id: "".to_string(),
    };

    match check_ticket(&params.ticket, &ticket_cache, &extract_addr(&req), &tt).await {
        Ok(_) => {
            log(Some(&start_time), &uinf, "is_ticket_valid", "", ResultCode::Ok);
            Ok(HttpResponse::Ok().json(true))
        },
        Err(e) => {
            log(Some(&start_time), &uinf, "is_ticket_valid", "", e);
            Ok(HttpResponse::Ok().json(false))
        },
    }
}

#[get("/authenticate")]
pub(crate) async fn authenticate(params: web::Query<AuthenticateRequest>, auth: web::Data<Mutex<AuthClient>>, req: HttpRequest) -> io::Result<HttpResponse> {
    let start_time = Instant::now();
    let mut uinf = UserInfo {
        ticket: None,
        addr: extract_addr(&req),
        user_id: "".to_string(),
    };
    return match auth.lock().await.authenticate(&params.login, &params.password, extract_addr(&req), &params.secret) {
        Ok(r) => {
            uinf.ticket = Some(r["id"].as_str().unwrap_or("").to_string());
            log(Some(&start_time), &uinf, "authenticate", &r["user_uri"].as_str().unwrap_or(""), ResultCode::Ok);
            Ok(HttpResponse::Ok().json(r))
        },
        Err(e) => {
            log(Some(&start_time), &uinf, "authenticate", &params.login, e.result);
            Ok(HttpResponse::new(StatusCode::from_u16(e.result as u16).unwrap()))
        },
    };
}

#[get("/get_rights")]
pub(crate) async fn get_rights(
    params: web::Query<TicketUriRequest>,
    ticket_cache: web::Data<TicketCache>,
    db: web::Data<AStorage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    req: HttpRequest,
) -> io::Result<HttpResponse> {
    let start_time = Instant::now();
    let uinf = match get_user_info(params.ticket.to_owned(), &req, &ticket_cache, &db).await {
        Ok(u) => u,
        Err(res) => {
            return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
        },
    };

    let rights = az
        .lock()
        .await
        .authorize(&params.uri, &uinf.user_id, Access::CanRead as u8 | Access::CanCreate as u8 | Access::CanDelete as u8 | Access::CanUpdate as u8, false)
        .unwrap_or(0);
    let mut pstm = Individual::default();

    pstm.set_id("_");
    pstm.add_uri("rdf:type", "v-s:PermissionStatement");
    for ch_access in ACCESS_8_LIST {
        if rights & ch_access > 0 {
            pstm.add_bool(ACCESS_PREDICATE_LIST[ch_access as usize], rights & ch_access > 0);
        }
    }

    log(Some(&start_time), &uinf, "get_rights", &params.uri, ResultCode::Ok);
    return Ok(HttpResponse::Ok().json(pstm.get_obj().as_json()));
}

#[get("/get_membership")]
pub(crate) async fn get_membership(
    params: web::Query<TicketUriRequest>,
    ticket_cache: web::Data<TicketCache>,
    db: web::Data<AStorage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    req: HttpRequest,
) -> io::Result<HttpResponse> {
    let user_id = match check_ticket(&params.ticket, &ticket_cache, &extract_addr(&req), &db).await {
        Ok(u) => u,
        Err(res) => {
            return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
        },
    };

    let mut acl_trace = Trace {
        acl: &mut "".to_string(),
        is_acl: false,
        group: &mut "".to_string(),
        is_group: true,
        info: &mut "".to_string(),
        is_info: false,
        str_num: 0,
    };

    if az.lock().await.authorize_and_trace(&params.uri, &user_id, Access::CanRead as u8, false, &mut acl_trace).unwrap_or(0) == Access::CanRead as u8 {
        let mut mbshp = Individual::default();

        mbshp.set_id("_");
        mbshp.add_uri("rdf:type", "v-s:Membership");
        for el in acl_trace.group.split('\n') {
            let n = el.trim();
            if !n.is_empty() {
                mbshp.add_uri("v-s:memberOf", n);
            }
        }
        mbshp.add_uri("v-s:resource", &params.uri);

        return Ok(HttpResponse::Ok().json(mbshp.get_obj().as_json()));
    }

    Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::BadRequest as u16).unwrap()))
}

#[get("/get_rights_origin")]
pub(crate) async fn get_rights_origin(
    params: web::Query<TicketUriRequest>,
    ticket_cache: web::Data<TicketCache>,
    db: web::Data<AStorage>,
    az: web::Data<Mutex<LmdbAzContext>>,
    req: HttpRequest,
) -> io::Result<HttpResponse> {
    let user_id = match check_ticket(&params.ticket, &ticket_cache, &extract_addr(&req), &db).await {
        Ok(u) => u,
        Err(res) => {
            return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
        },
    };

    let mut acl_trace = Trace {
        acl: &mut "".to_string(),
        is_acl: true,
        group: &mut "".to_string(),
        is_group: false,
        info: &mut "".to_string(),
        is_info: true,
        str_num: 0,
    };

    if az
        .lock()
        .await
        .authorize_and_trace(
            &params.uri,
            &user_id,
            Access::CanRead as u8 | Access::CanCreate as u8 | Access::CanDelete as u8 | Access::CanUpdate as u8,
            false,
            &mut acl_trace,
        )
        .unwrap_or(0)
        & Access::CanRead as u8
        > 0
    {
        let mut res = vec![];

        for el in acl_trace.acl.split('\n') {
            let n = el.trim();
            if !n.is_empty() {
                let mut indv = Individual::default();
                indv.set_id("_");
                indv.add_uri("rdf:type", "v-s:PermissionStatement");

                let r = n.split(';').collect::<Vec<&str>>();
                if r.len() == 3 {
                    indv.add_bool(r[2].trim(), true);
                    indv.add_uri("v-s:permissionObject", r[1].trim());
                    indv.add_uri("v-s:permissionSubject", r[0].trim());
                }
                res.push(indv.get_obj().as_json());
            }
        }

        let mut indv = Individual::default();
        indv.set_id("_");
        indv.add_uri("rdf:type", "v-s:PermissionStatement");
        indv.add_uri("v-s:permissionSubject", "?");
        indv.add_string("v-s:comment", acl_trace.info, Lang::none());
        res.push(indv.get_obj().as_json());

        return Ok(HttpResponse::Ok().json(res));
    }

    Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::BadRequest as u16).unwrap()))
}
