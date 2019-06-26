#!/bin/bash

TIMESTAMP=`date +%Y-%m-%d_%H_%M`

#mkdir ./logs/$TIMESTAMP
#cp ./logs/*-stderr.log ./logs/$TIMESTAMP

start-stop-daemon -Kp $PWD/.pids/veda-pid

target=".pids/"

if [ -e $target ] ; then

let count=0
for f in "$target"/*
do
    pid=`cat $target/$(basename $f)`
    echo STOP $pid $target/$(basename $f)
    kill -kill $pid
    let count=count+1
done
echo ""
echo "Count: $count"

rm -f -r .pids

fi

if [ -z $1 ] ; then

    echo "STOP VEDA MODULES"

else

if [ $1 == "all" ] ; then
    echo "STOP ALL VEDA MODULES"

    start-stop-daemon -Kp $PWD/veda-pid $PWD/veda
    killall -9 veda
    killall -9 veda-ccus
    killall -9 veda-fanout-email
    killall -9 veda-fanout-sql
    killall -9 veda-fanout-sql-np
    killall -9 veda-fanout-sql-lp
    killall -9 veda-ft-indexer
    killall -9 veda-scripts
    killall -9 veda-mstorage
    killall -9 veda-server
    killall -9 veda-ttlreader
    killall -9 veda-webserver
    killall -9 veda-input-queue
    killall -9 veda-gowebserver
    killall -9 veda-ft-query
    killall -9 veda-lmdb-srv
    killall -9 veda-ro-storage
    killall -9 veda-ontologist
    killall -9 veda-geo-indexer

    #tarantoolctl stop init_tarantool.lua
    pkill tarantool

fi

fi

exit 0