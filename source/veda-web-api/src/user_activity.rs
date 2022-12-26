use crate::common::UserId;
use chrono::Utc;
use futures::channel::mpsc::Receiver;
use futures::StreamExt;
use std::collections::HashMap;

const UPDATE_USER_ACTIVITY_PERIOD: i64 = 60;

pub async fn user_activity_manager(mut rx: Receiver<UserId>) {
    let mut user_activity = HashMap::new();

    info!("START USER ACTIVITY MANAGER");
    while let Some(user_id) = rx.next().await {
        debug!("Received user_id: {}", user_id);
        if user_id == "cfg:Guest" || user_id == "cfg:VedaSystem" {
            continue;
        }

        if let Some(activity_time) = user_activity.get_mut(&user_id) {
            let now = Utc::now().naive_utc().timestamp();
            let delta = now - *activity_time;
            if delta > UPDATE_USER_ACTIVITY_PERIOD {
                *activity_time = now;
                info!("CHANGE ACTIVITY, USER={user_id}, delta={}", delta);
            }
        } else {
            info!("CHANGE ACTIVITY, USER={user_id}");
            user_activity.insert(user_id.clone(), Utc::now().naive_utc().timestamp());
        }
    }
}
