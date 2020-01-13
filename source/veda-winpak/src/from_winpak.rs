use crate::common_winpak::*;
use chrono::prelude::*;
use futures::Future;
use futures_state_stream::StateStream;
use std::ops::Sub;
use tiberius::SqlConnection;
use time::Duration;
use tokio::runtime::current_thread;
use v_api::*;
use v_module::module::*;
use v_onto::datatype::Lang;
use v_onto::individual::*;

pub fn sync_data_from_winpak(module: &mut Module, systicket: &str, conn_str: &str, indv: &mut Individual) -> ResultCode {
    let card_number = indv.get_first_literal(CARD_NUMBER_FIELD_NAME);
    if card_number.is_none() {
        error!("fail read {}.{}", CARD_NUMBER_FIELD_NAME, indv.get_id());
        return ResultCode::UnprocessableEntity;
    }
    let param1 = card_number.unwrap_or_default();

    let mut card_data = (false, None, None, None, None, None, None, None, None);
    let mut access_levels = Vec::new();

    let future = SqlConnection::connect(conn_str)
        .and_then(|conn| {
            conn.query(CARD_DATA_QUERY, &[&param1.as_str()]).for_each(|row| {
                let f1 = row.get::<_, Option<NaiveDateTime>>(0);
                let f2 = row.get::<_, Option<NaiveDateTime>>(1);
                let f3 = row.get::<_, Option<i32>>(2);

                let f4 = if let Some(v) = row.get::<_, Option<&str>>(3) {
                    Some(v.to_owned())
                } else {
                    None
                };
                let f5 = if let Some(v) = row.get::<_, Option<&str>>(4) {
                    Some(v.to_owned())
                } else {
                    None
                };
                let f6 = if let Some(v) = row.get::<_, Option<&str>>(5) {
                    Some(v.to_owned())
                } else {
                    None
                };
                let f7 = if let Some(v) = row.get::<_, Option<&str>>(6) {
                    Some(v.to_owned())
                } else {
                    None
                };
                let f8 = if let Some(v) = row.get::<_, Option<&str>>(7) {
                    Some(v.to_owned())
                } else {
                    None
                };

                card_data = (true, f1, f2, f3, f4, f5, f6, f7, f8);
                Ok(())
            })
        })
        .and_then(|conn| {
            conn.query(ACCESS_LEVEL_QUERY, &[&param1.as_str()]).for_each(|row| {
                access_levels.push(row.get::<_, i32>(0).to_owned());
                Ok(())
            })
        });

    if let Err(e) = current_thread::block_on_all(future) {
        error!("fail execute sql query, err={:?}", e);
        match e {
            tiberius::Error::Server(_) => {
                return ResultCode::ConnectError;
            }
            tiberius::Error::Io(_) => {
                return ResultCode::ConnectError;
            }
            _ => {}
        }
    }

    if card_data.0 {
        info!("card_data={:?}", card_data);

        indv.clear("v-s:errorMessage");

        if let Some(v) = card_data.1 {
            indv.set_datetime("v-s:dateFrom", v.sub(Duration::hours(WINPAK_TIMEZONE)).timestamp());
        }

        if let Some(v) = card_data.2 {
            indv.set_datetime("v-s:dateTo", v.sub(Duration::hours(WINPAK_TIMEZONE)).timestamp());
        }

        if let Some(v) = card_data.3 {
            indv.set_integer("mnd-s:winpakCardRecordId", v.into());
        }

        if let Some(s) = card_data.4 {
            indv.set_string("v-s:description", &s, Lang::NONE);
        }

        if let Some(s) = card_data.5 {
            indv.set_string("v-s:tabNumber", &s, Lang::NONE);
        }

        if let Some(s) = card_data.6 {
            if let Ok(d) = NaiveDate::parse_from_str(&s, "%d.%m.%Y") {
                indv.set_datetime("v-s:birthday", d.and_hms (0,0,0).timestamp());
            } else {
                error!("fail parse date, v-s:birthday={}", &s);
            }
        }

        if let Some(s) = card_data.7 {
            indv.set_string("rdfs:comment", &s, Lang::NONE);
        }

        if let Some(s) = card_data.8 {
            indv.set_string("mnd-s:passEquipment", &s, Lang::NONE);
        }

        let mut access_level_uris = Vec::new();
        for level in access_levels {
            let mut indv = Individual::default();
            if module.storage.get_individual(&("d:winpak_accesslevel_".to_string() + &level.to_string()), &mut indv) {
                if let Some(v) = indv.get_first_literal("v-s:registrationNumber") {
                    if level.to_string() == v {
                        access_level_uris.push(indv.get_id().to_owned());
                    }
                }
            }
        }
        indv.set_uris("mnd-s:hasAccessLevel", access_level_uris);
    } else {
        error!("card [{}] not found in winpak database", param1);

        indv.clear("v-s:dateFrom");
        indv.clear("v-s:dateTo");
        indv.clear("mnd-s:winpakCardRecordId");
        indv.clear("v-s:description");
        indv.clear("v-s:tabNumber");
        indv.clear("v-s:birthday");
        indv.clear("rdfs:comment");
        indv.clear("mnd-s:passEquipment");
        indv.clear("mnd-s:hasAccessLevel");

        indv.clear("v-s:errorMessage");
        indv.add_string("v-s:errorMessage", "Карта не найдена", Lang::RU);
        indv.add_string("v-s:errorMessage", "Card not found", Lang::EN);
    }
    indv.set_uri("v-s:lastEditor", "cfg:VedaSystem");

    let res = module.api.update(systicket, IndvOp::Put, indv);
    if res.result != ResultCode::Ok {
        error!("fail update, uri={}, result_code={:?}", indv.get_id(), res.result);
        return ResultCode::DatabaseModifiedError;
    } else {
        info!("success update, uri={}", indv.get_id());
        return ResultCode::Ok;
    }
}
