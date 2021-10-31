#!/bin/bash

export APPDIR=$PWD/bin
VEDA_ID=A1

ulimit -c unlimited
mkdir .pids

if [ -f $PWD/ontology/config.ttl ]; then

    echo FOUND ONTOLOGY

else

    echo "EXTRACT ONTOLOGY & PROPS"
    cp -r ./dist/ontology ./
    cp -r ./dist/conf ./
    ln -s ./veda.properties ./data/veda.properties

fi

echo START VEDA
./bin/veda --id=$VEDA_ID no-watchdog>> $PWD/logs/veda-console.log 2>&1
