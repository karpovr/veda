#!/bin/bash

start-stop-daemon -Kp $PWD/.pids/veda-pid

target=".pids/"

if [ -e $target ] ; then

# Send SIGTERM signal to the process

for f in "$target"/*
do
    pid=`cat $target/$(basename $f)`
    echo SEND SIGTERM $pid $target/$(basename $f)
    kill -s SIGTERM $pid
done


# Wait for the process to exit or for 5 seconds to pass
for ((i=0; i<5; i++)); do
  # Check if the process has exited

    for f in "$target"/*
    do
	pid=`cat $target/$(basename $f)`

	if ps -p $pid > /dev/null; then
	    # Wait 1 second before checking again
	    echo wait stop $pid ...
	    sleep 1
	    break
	fi
    done

done


# Send SIGQUIT to any processes that are still running
for f in "$target"/*
do
    pid=`cat $target/$(basename $f)`
    if ps -p $pid > /dev/null; then
	echo "Process $pid did not terminate after SIGTERM, sending SIGQUIT"
	# Отправляем SIGQUIT процессу
	kill -QUIT $pid
    fi

done
echo ""

# Remove the .pids directory and its contents
rm -f -r .pids

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

exit 0

