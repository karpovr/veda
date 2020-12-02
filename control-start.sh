#!/bin/bash

export APPDIR=$PWD/bin
VEDA_ID=A1

ulimit -c unlimited
mkdir .pids
mkdir logs
mkdir data
mkdir data/tarantool
mkdir data/xapian-info

/sbin/start-stop-daemon --start --verbose --chdir $PWD --make-pidfile --pidfile $PWD/./.pids/tt-pid --background --startas /bin/bash -- -c "exec tarantool ./source/init_tarantool.lua 2>./logs/tarantool-stderr.log  >./logs/tarantool-stdout.log 2>&1"

#export RUST_LOG="debug,actix_server=info,actix_web=info"
#export RUST_BACKTRACE=1
LD_LIBRARY_PATH=./bin/lib /sbin/start-stop-daemon --start --verbose --chdir $PWD --make-pidfile --pidfile $PWD/./.pids/veda-pid --background --startas /bin/bash -- -c "exec ./bin/veda --id=$VEDA_ID no-watchdog>> $PWD/logs/veda-console.log 2>&1"
exit 0