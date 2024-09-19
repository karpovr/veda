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
mkdir data/oxigraph
mkdir data/xapian-info
mkdir data/acl-indexes

# start oxigraph server
#/sbin/start-stop-daemon --start --verbose --chdir $PWD --make-pidfile --pidfile $PWD/./.pids/oxigraph-pid --background --startas /bin/bash -- -c "exec ./oxigraph serve --location ./data/oxigraph -b 127.0.0.1:7878 2>./logs/oxigraph-stderr.log >./logs/oxigraph-stdout.log 2>&1"

# start tarantool server
/sbin/start-stop-daemon --start --verbose --chdir $PWD --make-pidfile --pidfile $PWD/./.pids/tt-pid --background --startas /bin/bash -- -c "exec tarantool ./source-server/source/init_tarantool.lua 2>./logs/tarantool-stderr.log  >./logs/tarantool-stdout.log 2>&1"

sleep 10

# Установка переменной LD_LIBRARY_PATH
export LD_LIBRARY_PATH=./bin/lib

# Узнаем текущий путь для сохранения core-файлов
CORE_PATTERN=$(cat /proc/sys/kernel/core_pattern)
echo "Current core dump pattern: $CORE_PATTERN"

#export RUST_LOG="debug,actix_server=info,actix_web=info"
#export RUST_BACKTRACE=1
export AUTH_URL=tcp://127.0.0.1:8113
/sbin/start-stop-daemon --start --verbose --chdir $PWD --make-pidfile --pidfile $PWD/./.pids/veda-pid --background --startas /bin/bash -- -c "exec ./bin/veda --id=$VEDA_ID no-watchdog>> $PWD/logs/veda-console.log 2>&1"
/sbin/start-stop-daemon --start --verbose --chdir $PWD --make-pidfile --pidfile $PWD/./.pids/veda-pid --background --startas /bin/bash -- -c "exec ./bin/veda-auth --id=$VEDA_ID no-watchdog>> $PWD/logs/veda-console.log 2>&1"

./bin/veda-mstorage
if [ $? -eq 139 ]; then  # Код выхода 139 соответствует Segmentation fault
    echo "Segmentation fault detected. Running GDB..."

    # Путь к core-файлу на основе шаблона
    CORE_DIR=$(dirname "$CORE_PATTERN")
    if [[ $CORE_PATTERN == /* ]]; then
        CORE_FILE_PATTERN=$CORE_PATTERN
    else
        CORE_FILE_PATTERN="$PWD/$CORE_PATTERN"
    fi

    # Подставляем значения переменных в шаблон core-файла
    CORE_FILE=$(echo $CORE_FILE_PATTERN | sed "s/%e/veda-mstorage/" | sed "s/%p/$$/" | sed "s/%t/$(date +%s)/")

    # Проверяем, существует ли core-файл
    if [ -f "$CORE_FILE" ]; then
        # Запуск GDB для анализа core-файла
        gdb ./bin/veda-mstorage "$CORE_FILE" -ex "bt"
    else
        echo "Core file not found: $CORE_FILE"
    fi
fi

exit 0
