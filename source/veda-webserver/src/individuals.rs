use actix_web::{web, Error, HttpRequest, HttpResponse};
use futures::future;
use futures::future::Future;
use rusty_tarantool::tarantool::Client;
use serde_json::value::Value as JSONValue;
use v_onto::{individual::*, parser::*};

#[derive(Debug, Deserialize, PartialEq, Serialize)]
struct GetIndividualResponse(Vec<u8>);

#[derive(Debug, Deserialize, PartialEq, Serialize)]
pub struct GetIndividualRequest {
    ticket: Option<String>,
    uri: Option<String>,
}

pub fn get_individual_handler(req: HttpRequest, params: web::Query<GetIndividualRequest>) -> Box<dyn Future<Item = HttpResponse, Error = Error>> {
    let tarantool = req.app_data::<Client>().unwrap();
    //println!("call tarantool! {:?}", params);
    let response = tarantool
        .call_fn2("libtarantool_veda.get_individual", &params.ticket, &params.uri)
        .and_then(move |response| Ok(GetIndividualResponse(response.decode_single()?)))
        .map(|result| HttpResponse::Ok().json(indv_to_json(result.0)))
        .or_else(move |err| {
            let body = format!("Internal error: {}", err.to_string());
            future::ok::<_, Error>(HttpResponse::InternalServerError().body(body))
        });
    Box::new(response)
}

fn indv_to_json(data: Vec<u8>) -> JSONValue {
    //    info! ("data={:?}", data);
    let mut indv = Individual::new_raw(RawObj::new(data));
    if parse_raw(&mut indv).is_ok() {
        indv.parse_all();
        //        info! ("indv={}", indv);
        return indv.get_obj().as_json();
    } else {
        error!("failed to parse individual, len = {}", indv.get_raw_len());
    }
    return JSONValue::default();
}
