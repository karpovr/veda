#!/bin/bash

# Reading Telegram settings and stand name from the veda.properties file
TELEGRAM_BOT_TOKEN=$(grep "tg_notify_token" ./veda.properties | cut -d'=' -f2 | tr -d ' "')
TELEGRAM_CHAT_ID=$(grep "tg_notify_chat_id" ./veda.properties | cut -d'=' -f2 | tr -d ' ')
STAND_NAME=$(grep "name" ./veda.properties | cut -d'=' -f2 | tr -d ' "')

# Configuration variables
WAIT_INTERVAL=10
CHECK_INTERVAL=20
FORCE_STOP_CHECK_INTERVAL=5

target=".pids/"

# Read all PIDs into an array
pids=()
if [ -e $target ]; then
    for f in "$target"/*
    do
        pid=$(cat "$f")
        pids+=("$pid")
    done
fi

# Function to send messages to Telegram
send_telegram_message() {
    local message="Stand: $STAND_NAME. $1"
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
        -d chat_id="$TELEGRAM_CHAT_ID" \
        -d text="$message" \
        -d parse_mode="Markdown"
}

# Function to stop veda processes
stop_veda() {
    local pids=("$@")

    # Send SIGTERM to all processes
    for pid in "${pids[@]}"; do
        echo SEND SIGTERM $pid
        kill -s SIGTERM $pid
    done

    # Wait for processes to stop or for the time specified in WAIT_INTERVAL to pass
    for ((i=0; i<$WAIT_INTERVAL; i++)); do
        all_stopped=true
        for pid in "${pids[@]}"; do
            if ps -p $pid > /dev/null; then
                all_stopped=false
                echo wait stop $pid ...
                sleep 1
                break
            fi
        done
        if $all_stopped; then
            break
        fi
    done

    # Send SIGQUIT to any processes that are still running
    for pid in "${pids[@]}"; do
        if ps -p $pid > /dev/null; then
            echo "Process $pid did not terminate after SIGTERM, sending SIGQUIT"
            kill -QUIT $pid
        fi
    done
    echo ""

    # Check veda processes for the time specified in CHECK_INTERVAL
    for ((i=0; i<$CHECK_INTERVAL; i++)); do
        veda_processes_running=false
        for pid in "${pids[@]}"; do
            if ps -p $pid > /dev/null; then
                veda_processes_running=true
                echo "VEDA process $pid is still running, waiting..."
                break
            fi
        done
        if ! $veda_processes_running; then
            echo "No VEDA processes detected, exiting loop."
            break
        fi
        sleep 1
    done

    # If veda processes are still detected after checking, forcibly stop them
    veda_processes_running=false
    for pid in "${pids[@]}"; do
        if ps -p $pid > /dev/null; then
            veda_processes_running=true
            echo "Forcibly stopping VEDA process $pid using kill -KILL"
            kill -KILL $pid
        fi
    done

    # Check veda processes for the time specified in FORCE_STOP_CHECK_INTERVAL after force stop
    for ((i=0; i<$FORCE_STOP_CHECK_INTERVAL; i++)); do
        veda_processes_running=false
        for pid in "${pids[@]}"; do
            if ps -p $pid > /dev/null; then
                veda_processes_running=true
                echo "VEDA process $pid is still running after force stop, waiting..."
                break
            fi
        done
        if ! $veda_processes_running; then
            echo "No VEDA processes detected after force stop, exiting loop."
            break
        fi
        sleep 1
    done

    # Check for any remaining processes at the end of the function
    for pid in "${pids[@]}"; do
        if ps -p $pid > /dev/null; then
            return 1  # Returns false if at least one process is still running
        fi
    done

    return 0  # Returns true if all processes were successfully stopped
}

# Stop veda-bootstrap
start-stop-daemon -Kp $PWD/.pids/veda-pid

# Call the stop_veda function with the pids array
if stop_veda "${pids[@]}"; then
    echo "All VEDA processes were successfully stopped."
    # Remove the .pids directory and its contents only if all processes were successfully stopped
    rm -f -r .pids
else
    echo "Failed to stop all VEDA processes."
    send_telegram_message "Failed to stop all VEDA processes."
fi

if [ -z $1 ] ; then
    echo "STOP VEDA MODULES"
else
    # If "all" is provided as an argument, stop all VEDA modules
    if [ $1 == "all" ] ; then
        echo "STOP ALL VEDA MODULES"
        start-stop-daemon -Kp $PWD/veda-pid $PWD/veda
        killall -9 veda-*
        killall -9 veda

        #tarantoolctl stop init_tarantool.lua
    	pkill tarantool

    fi
fi

ps aux | grep veda

exit 0

