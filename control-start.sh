#!/bin/bash

if pgrep -f -l -U $USER '[t]arantool init_tarantool.lua'; then
    echo
    echo Attention! Tarantool database process is already running, please stop it before starting Veda. Run script.
    echo $ ./control-stop.sh all
    echo to stop tarantool and try to start veda again
    echo
    exit 0
else
    echo
fi

export APPDIR=$PWD/bin
VEDA_ID=A1

ulimit -c unlimited
mkdir .pids
mkdir logs
mkdir data
mkdir data/tarantool
mkdir data/xapian-info

# start oxygraph server
#/sbin/start-stop-daemon --start --verbose --chdir $PWD --make-pidfile --pidfile $PWD/./.pids/oxy-pid --background --startas /bin/bash -- -c "exec oxigraph_server --location ./data/oxygraph serve 2>./logs/oxygraph-stderr.log >./logs/oxygraph-stdout.log 2>&1"

# start tarantool server
/sbin/start-stop-daemon --start --verbose --chdir $PWD --make-pidfile --pidfile $PWD/./.pids/tt-pid --background --startas /bin/bash -- -c "exec tarantool ./source/init_tarantool.lua 2>./logs/tarantool-stderr.log  >./logs/tarantool-stdout.log 2>&1"

#export RUST_LOG="debug,actix_server=info,actix_web=info"
#export RUST_BACKTRACE=1
export AUTH_URL=tcp://127.0.0.1:8113
LD_LIBRARY_PATH=./bin/lib /sbin/start-stop-daemon --start --verbose --chdir $PWD --make-pidfile --pidfile $PWD/./.pids/veda-pid --background --startas /bin/bash -- -c "exec ./bin/veda --id=$VEDA_ID no-watchdog>> $PWD/logs/veda-console.log 2>&1"
exit 0