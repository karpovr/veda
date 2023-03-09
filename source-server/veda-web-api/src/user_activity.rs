use crate::common::{db_connector, read_system_ticket_id, UserId};
use chrono::Utc;
use futures::channel::mpsc::Receiver;
use futures::StreamExt;
use rusty_tarantool::tarantool::ClientConfig;
use std::collections::HashMap;
use std::io;
use std::io::{Error, ErrorKind};
use v_common::module::module_impl::Module;
use v_common::onto::individual::Individual;
use v_common::storage::async_storage::{get_individual_from_db, AStorage};
use v_common::v_api::api_client::{IndvOp, MStorageClient};
use v_common::v_api::obj::ResultCode;

const UPDATE_USER_ACTIVITY_PERIOD: i64 = 60;

pub async fn user_activity_manager(mut rx: Receiver<UserId>, tt_config: Option<ClientConfig>) {
    let mut user_activity = HashMap::new();

    let mut storage = AStorage {
        tt: None,
        lmdb: None,
    };
    let mut sys_ticket = String::new();
    let mut mstorage_client = None;

    info!("START USER ACTIVITY MANAGER");
    while let Some(user_id) = rx.next().await {
        if storage.lmdb.is_none() && storage.tt.is_none() {
            info!("connect to database");
            storage = db_connector(&tt_config);
            sys_ticket = read_system_ticket_id(&storage).await.expect("fail read system_ticket");
            mstorage_client = Some(MStorageClient::new(Module::get_property("main_module_url").unwrap_or_default()));
        }

        debug!("Received user_id: {}", user_id);
        if user_id == "cfg:Guest" || user_id == "cfg:VedaSystem" {
            continue;
        }

        let now = Utc::now().naive_utc().timestamp();
        if let Some(activity_time) = user_activity.get_mut(&user_id) {
            let delta = now - *activity_time;
            if delta > UPDATE_USER_ACTIVITY_PERIOD {
                *activity_time = now;
                if let Err(e) = update_activity_into_storage(&user_id, now, &storage, &mut mstorage_client, &sys_ticket).await {
                    error!("{}", e);
                }
            }
        } else {
            user_activity.insert(user_id.clone(), now);
            if let Err(e) = update_activity_into_storage(&user_id, now, &storage, &mut mstorage_client, &sys_ticket).await {
                error!("{}", e);
            }
        }
    }
}

async fn update_activity_into_storage(
    user_id: &str,
    now_time: i64,
    storage: &AStorage,
    mstorage_client: &mut Option<MStorageClient>,
    system_ticket: &str,
) -> io::Result<()> {
    info!("CHANGE ACTIVITY, USER={user_id}");
    let mstorage_client = mstorage_client.as_mut().unwrap();
    let user_info_id = format!("{user_id}-userinfo");

    let (mut user, res_code) = get_individual_from_db(&user_info_id, user_id, storage, None).await?;

    if res_code == ResultCode::Ok {
        let prev_time = user.get_first_datetime("v-s:lastSeen").unwrap_or_default();
        if now_time - prev_time > UPDATE_USER_ACTIVITY_PERIOD {
            let mut user_info = Individual::default();
            user_info.set_id(&user_info_id);
            user_info.set_datetime("v-s:lastSeen", now_time);

            if let Err(e) = mstorage_client.update_or_err(system_ticket, "", "", IndvOp::SetIn, &user_info) {
                return Err(Error::new(ErrorKind::Other, format!("fail update user-info object, err={e}")));
            }
            info!("UPDATE USER ACTIVITY, USER={user_id}, OBJ={user_info_id}");
        }
    } else {
        // create user-info object
        let mut user_info = Individual::default();
        user_info.set_id(&user_info_id);
        user_info.set_uri("rdf:type", "v-s:UserInfo");
        user_info.set_datetime("v-s:lastSeen", now_time);

        if let Err(e) = mstorage_client.update_or_err(system_ticket, "", "", IndvOp::Put, &user_info) {
            return Err(Error::new(ErrorKind::Other, format!("fail update user-info object, err={e}")));
        }
        info!("UPDATE USER ACTIVITY, USER={user_id}, OBJ={user_info_id}");
    }

    Ok(())
}
