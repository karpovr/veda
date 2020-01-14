use ini::Ini;
use std::{thread, time};
use v_queue::consumer::Consumer;
use v_queue::record::Mode;

fn main() {
    let config_file_path = "/etc/netdata/veda-plugin-properties.ini";

    let conf = Ini::load_from_file(config_file_path).expect(&format!("fail load {} file", config_file_path));

    let section = conf.section(None::<String>).expect(&format!("fail parse {}", config_file_path));
    let queue_list_conf = section.get("queue_list").expect(&format!("param [queue_list] not found in {}", config_file_path)).clone();
    let veda_queue_path = section.get("veda_queue_path").expect(&format!("param [veda_queue_path] not found in {}", config_file_path)).clone();

    println!("CHART netdata.plugin_veda_queue '' 'Veda queue' 'count' veda.d '' area 10000 3");

    let mut queue_list = vec![];
    for el in queue_list_conf.split(",") {
        if let Ok(queue_consumer) = Consumer::new_with_mode(&veda_queue_path, &el.trim().to_string(), "individuals-flow", Mode::Read) {
            queue_list.push(queue_consumer);
        }
    }

    for consumer in queue_list.iter() {
        println!("DIMENSION queue_{} '{}' absolute 1 1", consumer.name, consumer.name);
    }

    loop {
        println!("BEGIN netdata.plugin_veda_queue");

        for consumer in queue_list.iter_mut() {
            if consumer.queue.get_info_queue() {
                if consumer.queue.get_info_of_part(consumer.queue.id, true).is_ok() {
                    if consumer.get_info() {
                        if consumer.queue.count_pushed >= consumer.count_popped {
                            let delta = consumer.queue.count_pushed - consumer.count_popped;
                            println!("SET queue_{}={}", consumer.name, delta);
                        }
                    }
                }
            }
        }
        println!("END");

        thread::sleep(time::Duration::from_millis(3000));
    }
}
