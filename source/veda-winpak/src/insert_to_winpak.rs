use crate::common_winpak::*;
use chrono::Utc;
use futures::Future;
use futures_state_stream::StateStream;
use std::cell::Cell;
use tiberius::SqlConnection;
use tokio::runtime::current_thread;
use v_api::*;
use v_module::module::*;
use v_onto::datatype::Lang;
use v_onto::individual::*;
use v_api::app::ResultCode;

pub fn insert_to_winpak<'a>(module: &mut Module, systicket: &str, conn_str: &str, indv: &mut Individual) -> ResultCode {
    let (sync_res, info) = sync_data_to_winpak(module, conn_str, indv);
    if sync_res == ResultCode::ConnectError {
        return sync_res;
    }

    indv.set_uri("v-s:lastEditor", "cfg:VedaSystem");

    if sync_res == ResultCode::Ok {
        indv.set_uri("v-s:hasStatus", "v-s:StatusAccepted");
    } else {
        indv.set_uri("v-s:hasStatus", "v-s:StatusRejected");
        indv.add_string("v-s:errorMessage", info, Lang::RU);
    }
    indv.clear("v-s:errorMessage");

    info!("update from {}, status={:?}, info={}", indv.get_id(), sync_res, info);
    let res = module.api.update(systicket, IndvOp::Put, indv);
    if res.result != ResultCode::Ok {
        error!("fail update, uri={}, result_code={:?}", indv.get_id(), res.result);
    } else {
        info!("success update, uri={}", indv.get_id());
    }
    sync_res
}

fn sync_data_to_winpak<'a>(module: &mut Module, conn_str: &str, indv: &mut Individual) -> (ResultCode, &'a str) {
    let backward_target = indv.get_first_literal("v-s:backwardTarget");
    if backward_target.is_none() {
        error!("not found [v-s:backwardTarget] in {}", indv.get_id());
        return (ResultCode::NotFound, "исходные данные некорректны");
    }
    let backward_target = backward_target.unwrap();

    let indv_b = module.get_individual_h(&backward_target);
    if indv_b.is_none() {
        error!("not found {}", &backward_target);
        return (ResultCode::NotFound, "исходные данные некорректны");
    }
    let mut indv_b = indv_b.unwrap();

    let has_kind_for_pass = indv_b.get_literals("mnd-s:hasPassKind");
    if has_kind_for_pass.is_none() {
        error!("not found [mnd-s:hasKindForPass] in {}", indv_b.get_id());
        return (ResultCode::NotFound, "исходные данные некорректны");
    }
    let has_kind_for_passes = has_kind_for_pass.unwrap();

    let wcard_number = indv_b.get_first_literal("mnd-s:cardNumber");
    if wcard_number.is_none() {
        error!("not found [mnd-s:cardNumber] in {}", indv_b.get_id());
        return (ResultCode::NotFound, "исходные данные некорректны");
    }
    let card_number = wcard_number.unwrap();

    let mut equipment_list = Vec::new();

    get_equipment_list(&mut indv_b, &mut equipment_list);

    let mut is_vehicle = false;
    let mut is_human = false;

    for has_kind_for_pass in has_kind_for_passes {
        if has_kind_for_pass == "d:c94b6f98986d493cae4a3a37249101dc"
            || has_kind_for_pass == "d:5f5be080f1004af69742bc574c030609"
            || has_kind_for_pass == "d:1799f1e110054b5a9ef819754b0932ce"
        {
            is_human = true;
        }
        if has_kind_for_pass == "d:ece7e741557e406bb996809163810c6e"
            || has_kind_for_pass == "d:a149d268628b46ae8d40c6ea0ac7f3dd"
            || has_kind_for_pass == "d:228e15d5afe544c099c337ceafa47ea6"
        {
            is_vehicle = true;
        }
    }

    let date_from = indv_b.get_first_datetime("v-s:dateFromFact");
    let date_to = indv_b.get_first_datetime("v-s:dateToFact");

    let mut access_levels: Vec<i64> = Vec::new();
    get_access_level(&mut indv_b, &mut access_levels);

    let now = Utc::now().naive_utc();
    let id = now.format("%Y-%m-%d %H:%M:%S.f").to_string();

    let ftran = SqlConnection::connect(conn_str).and_then(|conn| conn.transaction());
    let ftran =
        ftran.and_then(|trans| insert_card_holder(&id, now, is_human, is_vehicle, module, card_number.to_string(), &mut indv_b, trans)).and_then(|trans| trans.commit());
    match current_thread::block_on_all(ftran) {
        Ok(_) => {}
        Err(e) => {
            error!("fail execute query, err={:?}", e);
        }
    }

    let cardholder_id = Cell::new(0);

    let ftran = SqlConnection::connect(conn_str).and_then(|conn| conn.transaction());
    let ftran = ftran.and_then(|conn| {
        conn.query("SELECT [RecordID] FROM [WIN-PAK PRO].[dbo].[CardHolder] WHERE [Note32]=@P1 and [Note20]=@P2", &[&card_number.as_str(), &id.as_str()]).for_each(
            |row| {
                if cardholder_id.get() == 0 {
                    cardholder_id.set(row.get::<_, i32>(0).to_owned());
                    info!("@2 cardholder_id={:?}", cardholder_id);
                }
                Ok(())
            },
        )
    });
    match current_thread::block_on_all(ftran) {
        Ok(_) => {}
        Err(e) => {
            error!("fail insert CardHolder, err={:?}", e);
            return (ResultCode::DatabaseModifiedError, "ошибка обновления");
        }
    }

    if cardholder_id.get() == 0 {
        error!("ошибка получения id для CardHolder");
        return (ResultCode::DatabaseModifiedError, "ошибка обновления");
    } else {
        let ftran = SqlConnection::connect(conn_str)
            .and_then(|conn| conn.transaction())
            .and_then(|trans| clear_temp_field_of_cardholder(cardholder_id.get(), trans))
            .and_then(|trans| update_equipment_where_id(equipment_list, cardholder_id.get(), trans))
            .and_then(|trans| clear_card(card_number.to_string(), trans))
            .and_then(|trans| insert_card(now, card_number.to_string(), date_from, date_to, cardholder_id.get(), trans))
            .and_then(|trans| clear_access_level(true, card_number.to_string(), trans))
            .and_then(|trans| update_access_level(true, now, 0, access_levels, card_number.to_string(), trans))
            .and_then(|trans| trans.commit());
        match current_thread::block_on_all(ftran) {
            Ok(_) => {
                return (ResultCode::Ok, "данные обновлены");
            }
            Err(e) => {
                error!("fail execute query, err={:?}", e);
                return (ResultCode::DatabaseModifiedError, "ошибка обновления");
            }
        }
    }
}
