package main

import (
//	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/BurntSushi/toml"
)

var httpClient *http.Client

func createRequest(url string) (*http.Request, error) {
	httpClient = &http.Client{}
	req, err := http.NewRequest("GET", url+"/debug/vars", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Add("Accept", "application/json")

	return req, nil
}

type Config struct {
	Ccus_url        string
	Veda_queue_path string
}

func ReadConfig() Config {
	var configfile = "/etc/netdata/veda-plugin-properties.ini"
	_, err := os.Stat(configfile)
	if err != nil {
		log.Fatal("Config file is missing: ", configfile)
	}

	var config Config
	if _, err := toml.DecodeFile(configfile, &config); err != nil {
		log.Fatal(err)
	}
//	log.Printf("CONFIG: veda_queue_path=%s\n", config.Veda_queue_path)
	return config
}

func main() {
	config := ReadConfig()

//	fmt.Println("CHART netdata.plugin_vedad_count_requests '' 'Veda count_requests' 'count' veda.d " +
//		" '' area 1000 3")
//	fmt.Println("DIMENSION count_requests 'count requests' absolute 1 1" +
//		" '' area 1000 3")

	fmt.Println("CHART netdata.plugin_vedad_count_updates '' 'Veda count_updates' 'count' veda.d " +
		" '' area 10000 3")
	fmt.Println("DIMENSION count_updates 'count updates' absolute 1 1" +
		" '' area 10000 3")

	fmt.Println("CHART netdata.plugin_vedad_dt_count_updates '' 'Veda dt_count_updates' 'count' " +
		"veda.d '' area 10000 3")
	fmt.Println("DIMENSION dt_count_updates 'dt count updates' absolute 1 1")

	fmt.Println("CHART netdata.plugin_veda_queue_scripts_main '' 'Veda queue_scripts_main' 'count' " +
		"veda.d '' area 10000 3")

	fmt.Println("DIMENSION queue_fanout_email0 'email' absolute 1 1")
	fmt.Println("DIMENSION queue_scripts_main0 'scripts_main0' absolute 1 1")
	fmt.Println("DIMENSION queue_scripts_lp0 'scripts_lp0' absolute 1 1")
	fmt.Println("DIMENSION queue_scripts_lp1 'scripts_lp1' absolute 1 1")
	fmt.Println("DIMENSION queue_fanout_sql_lp0 'sql_lp' absolute 1 1")
	fmt.Println("DIMENSION queue_fanout_sql_np0 'sql_np' absolute 1 1")
	fmt.Println("DIMENSION queue_fulltext_indexer0 'fulltext_indexer0' absolute 1 1")
	fmt.Println("DIMENSION queue_fulltext_indexer1 'fulltext_indexer1' absolute 1 1")
	fmt.Println("DIMENSION queue_CCUS 'CCUS1' absolute 1 1")

	fmt.Println("CHART netdata.plugin_veda_users '' 'Veda users' 'count' veda.d '' area 10000 3")
	fmt.Println("DIMENSION ws_sessions 'ws sessions' absolute 1 1  '' area 10000 3")
	fmt.Println("DIMENSION ws_hosts 'ws hosts' absolute 1 1 '' area 10000 3")

//	req, err := createRequest(config.Ccus_url)
//	if err != nil {
//		log.Println(err)
//	}

	var main_queue *Queue

	main_queue_name := "individuals-flow"
	main_queue = NewQueue(main_queue_name, R, config.Veda_queue_path)
	main_queue.open(CURRENT)

	cs_CCUS := NewConsumer(main_queue, "CCUS1", R)
	cs_CCUS.open()

	cs_fanout_email := NewConsumer(main_queue, "fanout_email0", R)
	cs_fanout_email.open()

	cs_fanout_sql_lp := NewConsumer(main_queue, "fanout_sql_lp0", R)
	cs_fanout_sql_lp.open()

	cs_fanout_sql_np := NewConsumer(main_queue, "fanout_sql_np0", R)
	cs_fanout_sql_np.open()

	cs_fulltext_indexer0 := NewConsumer(main_queue, "fulltext_indexer0", R)
	cs_fulltext_indexer0.open()

	cs_fulltext_indexer1 := NewConsumer(main_queue, "fulltext_indexer1", R)
	cs_fulltext_indexer1.open()

	cs_scripts_main := NewConsumer(main_queue, "scripts_main0", R)
	cs_scripts_main.open()

	cs_scripts_lp := NewConsumer(main_queue, "scripts_lp0", R)
	cs_scripts_lp.open()

	cs_scripts_lp1 := NewConsumer(main_queue, "scripts_lp10", R)
	cs_scripts_lp1.open()

	cs_ltr_scripts := NewConsumer(main_queue, "ltr_scripts0", R)
	cs_ltr_scripts.open()

	vedaData := make(map[string]interface{})
	for {

/*
		respStream, err := httpClient.Do(req)
		if err != nil {
			log.Println("Failed to do request: ", err)
			respStream.Body.Close()
			time.Sleep(5000 * time.Millisecond)
			req, err = createRequest(config.Ccus_url)
			if err != nil {
				log.Println(err)
			}

			continue
		}

		decoder := json.NewDecoder(respStream.Body)
		err = decoder.Decode(&vedaData)
		if err != nil {
			// log.Println("Error on decoding json: ", err)
			respStream.Body.Close()
			time.Sleep(5000 * time.Millisecond)
			req, err = createRequest(config.Ccus_url)
			if err != nil {
				log.Println(err)
			}

			continue
		}
*/

//		fmt.Println("BEGIN netdata.plugin_vedad_count_requests")
//		fmt.Printf("SET count_requests=%v\n", vedaData["count_requests"])
//		fmt.Println("END")

		fmt.Println("BEGIN netdata.plugin_vedad_count_updates")
		fmt.Printf("SET count_updates=%v\n", vedaData["count_updates"])
		fmt.Println("END")

		fmt.Println("BEGIN netdata.plugin_veda_users")
		fmt.Printf("SET ws_sessions=%v\n", vedaData["count_ws_sessions"])
		fmt.Printf("SET ws_hosts=%v\n", vedaData["count_ws_hosts"])
		fmt.Println("END")

		fmt.Println("BEGIN netdata.plugin_vedad_dt_count_updates")
		fmt.Printf("SET dt_count_updates=%v\n", vedaData["dt_count_updates"])
		fmt.Println("END")

    		cs_fanout_email.get_info()
    		cs_fanout_sql_lp.get_info()
    		cs_fanout_sql_np.get_info()
    		cs_fulltext_indexer0.get_info()
    		cs_fulltext_indexer1.get_info()
    		cs_scripts_main.get_info()
    		cs_scripts_lp.get_info()
    		cs_scripts_lp1.get_info()
    		cs_ltr_scripts.get_info()
    		cs_CCUS.get_info()

		//fmt.Println(main_queue.get_info_queue ())
		main_queue.get_info_push (main_queue.id)
		//fmt.Printf("main_queue.id=%d, main_queue.count_pushed=%d\n",main_queue.id, main_queue.count_pushed)

		fmt.Println("BEGIN netdata.plugin_veda_queue_scripts_main")
		fmt.Printf("SET queue_fanout_email0=%d\n", main_queue.count_pushed - cs_fanout_email.count_popped)
		fmt.Printf("SET queue_scripts_main0=%d\n", main_queue.count_pushed - cs_scripts_main.count_popped)
		fmt.Printf("SET queue_scripts_lp0=%d\n", main_queue.count_pushed - cs_scripts_lp.count_popped)
		fmt.Printf("SET queue_scripts_lp1=%d\n", main_queue.count_pushed - cs_scripts_lp1.count_popped)
		fmt.Printf("SET queue_fanout_sql_lp0=%d\n", main_queue.count_pushed - cs_fanout_sql_lp.count_popped)
		fmt.Printf("SET queue_fanout_sql_np0=%d\n", main_queue.count_pushed - cs_fanout_sql_np.count_popped)
		fmt.Printf("SET queue_fulltext_indexer0=%d\n", main_queue.count_pushed - cs_fulltext_indexer0.count_popped)
		fmt.Printf("SET queue_fulltext_indexer1=%d\n", main_queue.count_pushed - cs_fulltext_indexer1.count_popped)
		fmt.Printf("SET queue_CCUS=%d\n", main_queue.count_pushed - cs_CCUS.count_popped)
		fmt.Println("END")

//		respStream.Body.Close()
		time.Sleep(3000 * time.Millisecond)
	}

	/*  sys.stdout.write(
	    "CHART netdata.plugin_pythond_" +
	    chart +
	    " '' 'Execution time for " +
	    chart +
	    " plugin' 'milliseconds / run' python.d netdata.plugin_python area 145000 " +
	    str(job.timetable['freq']) +
	    '\n')
	sys.stdout.write("DIMENSION run_time 'run time' absolute 1 1\n\n")*/
}

