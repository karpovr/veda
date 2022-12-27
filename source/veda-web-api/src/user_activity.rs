use crate::common::{db_connector, UserId};
use chrono::Utc;
use futures::channel::mpsc::Receiver;
use futures::StreamExt;
use rusty_tarantool::tarantool::ClientConfig;
use std::collections::HashMap;
use std::io;
use v_common::module::module_impl::Module;
use v_common::storage::async_storage::{get_individual_from_db, AStorage};
use v_common::v_api::api_client::MStorageClient;
use v_common::v_api::obj::ResultCode;

const UPDATE_USER_ACTIVITY_PERIOD: i64 = 60;

pub async fn user_activity_manager(mut rx: Receiver<UserId>, tt_config: Option<ClientConfig>) {
    let mut user_activity = HashMap::new();
    let mut storage = db_connector(&tt_config);
    let mstorage_client = MStorageClient::new(Module::get_property("main_module_url").unwrap_or_default());

    info!("START USER ACTIVITY MANAGER");
    while let Some(user_id) = rx.next().await {
        debug!("Received user_id: {}", user_id);
        if user_id == "cfg:Guest" || user_id == "cfg:VedaSystem" {
            continue;
        }

        let now = Utc::now().naive_utc().timestamp();
        if let Some(activity_time) = user_activity.get_mut(&user_id) {
            let delta = now - *activity_time;
            if delta > UPDATE_USER_ACTIVITY_PERIOD {
                *activity_time = now;
                if let Err(e) = update_activity_into_storage(&user_id, now, &storage, &mstorage_client).await {
                    error!("{}", e);
                }
            }
        } else {
            user_activity.insert(user_id.clone(), now);
            if let Err(e) = update_activity_into_storage(&user_id, now, &storage, &mstorage_client).await {
                error!("{}", e);
            }
        }
    }
}

async fn update_activity_into_storage(user_id: &str, now_time: i64, storage: &AStorage, mstorage_client: &MStorageClient) -> io::Result<()> {
    info!("CHANGE ACTIVITY, USER={user_id}");

    let (mut user, res_code) = get_individual_from_db(user_id, user_id, storage, None).await?;

    if res_code == ResultCode::Ok {
        let prev_time = user.get_first_datetime("v-s:lastSeen").unwrap_or_default();
        if now_time - prev_time > UPDATE_USER_ACTIVITY_PERIOD {
            info!("NEED STORE USER ACTIVITY, USER={user_id}");
        }
    }
    Ok(())
}
