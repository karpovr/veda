use crate::common::{check_ticket, AuthenticateRequest, TicketRequest, TicketUriRequest};
use crate::Storage;
use actix_web::get;
use actix_web::http::StatusCode;
use actix_web::{web, HttpResponse};
use futures::lock::Mutex;
use std::io;
use std::sync::Arc;
use v_common::az_impl::az_lmdb::LmdbAzContext;
use v_common::module::ticket::Ticket;
use v_common::onto::datatype::Lang;
use v_common::onto::individual::Individual;
use v_common::v_api::api_client::AuthClient;
use v_common::v_api::obj::ResultCode;
use v_common::v_authorization::common::{Access, AuthorizationContext, Trace, ACCESS_8_LIST, ACCESS_PREDICATE_LIST};

pub(crate) struct TicketCache {
    pub read: evmap::ReadHandle<String, Ticket>,
    pub(crate) write: Arc<Mutex<evmap::WriteHandle<String, Ticket>>>,
}

#[get("/is_ticket_valid")]
pub(crate) async fn is_ticket_valid(params: web::Query<TicketRequest>, ticket_cache: web::Data<TicketCache>, tt: web::Data<Storage>) -> io::Result<HttpResponse> {
    let (res, _) = check_ticket(&Some(params.ticket.clone()), &ticket_cache, &tt).await?;
    Ok(HttpResponse::Ok().json(res == ResultCode::Ok))
}

#[get("/authenticate")]
pub(crate) async fn authenticate(params: web::Query<AuthenticateRequest>, auth: web::Data<Mutex<AuthClient>>) -> io::Result<HttpResponse> {
    return match auth.lock().await.authenticate(&params.login, &params.password, &params.secret) {
        Ok(r) => Ok(HttpResponse::Ok().json(r)),
        Err(e) => Ok(HttpResponse::new(StatusCode::from_u16(e.result as u16).unwrap())),
    };
}

#[get("/get_rights")]
pub(crate) async fn get_rights(
    params: web::Query<TicketUriRequest>,
    ticket_cache: web::Data<TicketCache>,
    db: web::Data<Storage>,
    az: web::Data<Mutex<LmdbAzContext>>,
) -> io::Result<HttpResponse> {
    let (res, user_uri) = check_ticket(&params.ticket, &ticket_cache, &db).await?;
    if res != ResultCode::Ok {
        return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
    }

    let rights = az
        .lock()
        .await
        .authorize(&params.uri, &user_uri.unwrap(), Access::CanRead as u8 | Access::CanCreate as u8 | Access::CanDelete as u8 | Access::CanUpdate as u8, false)
        .unwrap_or(0);
    let mut pstm = Individual::default();

    pstm.set_id("_");
    pstm.add_uri("rdf:type", "v-s:PermissionStatement");
    for ch_access in ACCESS_8_LIST {
        if rights & ch_access > 0 {
            pstm.add_bool(ACCESS_PREDICATE_LIST[ch_access as usize], rights & ch_access > 0);
        }
    }

    return Ok(HttpResponse::Ok().json(pstm.get_obj().as_json()));
}

#[get("/get_membership")]
pub(crate) async fn get_membership(
    params: web::Query<TicketUriRequest>,
    ticket_cache: web::Data<TicketCache>,
    db: web::Data<Storage>,
    az: web::Data<Mutex<LmdbAzContext>>,
) -> io::Result<HttpResponse> {
    let (res, user_uri) = check_ticket(&params.ticket, &ticket_cache, &db).await?;
    if res != ResultCode::Ok {
        return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
    }

    let mut acl_trace = Trace {
        acl: &mut "".to_string(),
        is_acl: false,
        group: &mut "".to_string(),
        is_group: true,
        info: &mut "".to_string(),
        is_info: false,
        str_num: 0,
    };

    if az.lock().await.authorize_and_trace(&params.uri, &user_uri.unwrap(), Access::CanRead as u8, false, &mut acl_trace).unwrap_or(0) == Access::CanRead as u8 {
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
    db: web::Data<Storage>,
    az: web::Data<Mutex<LmdbAzContext>>,
) -> io::Result<HttpResponse> {
    let (res, user_uri) = check_ticket(&params.ticket, &ticket_cache, &db).await?;
    if res != ResultCode::Ok {
        return Ok(HttpResponse::new(StatusCode::from_u16(res as u16).unwrap()));
    }

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
            &user_uri.unwrap(),
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
        indv.add_uri("v-s:permissionObject", "?");
        indv.add_string("v-s:comment", acl_trace.info, Lang::NONE);
        res.push(indv.get_obj().as_json());

        return Ok(HttpResponse::Ok().json(res));
    }

    Ok(HttpResponse::new(StatusCode::from_u16(ResultCode::BadRequest as u16).unwrap()))
}
