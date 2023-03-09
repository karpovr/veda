build_server_module () {
    BUILD_PATH=$PWD
    VEDA_BIN=$BUILD_PATH/bin
    module_name=$1

    echo $module_name
    rm ./$module_name

    cd source-server/$module_name
    cargo build --release
    status=$?
    if test $status -ne 0
    then
	exit $status;
    fi
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/$module_name $VEDA_BIN
}

BUILD_PATH=$PWD

#!/bin/sh
rm *.log
rm ./logs/*.log
rm -r ./logs

mkdir ./bin
VEDA_BIN=$BUILD_PATH/bin

if [ ! -f ./ontology/config.ttl ]
then
  cp ./ontology/config.ttl.cfg ./ontology/config.ttl
fi

if [ ! -f ./ontology/system-accounts.ttl ]
then
  cp ./ontology/system-accounts.ttl.cfg ./ontology/system-accounts.ttl
fi

if [ ! -f ./ontology/test-data.ttl ]
then
  cp ./ontology/test-data.ttl.cfg ./ontology/test-data.ttl
fi

./tools/update-version-ttl.sh

export CARGO_TARGET_DIR=$HOME/target

    mkdir $VEDA_BIN/lib
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/libauthorization.so ./source/lib64/libauthorization.so
    cp $CARGO_TARGET_DIR/release/libauthorization.a ./source/lib64/libauthorization.a
    cp $CARGO_TARGET_DIR/release/libauthorization.so $VEDA_BIN/lib

if [ -z $1 ] || [ $1 == "bootstrap" ] || [ $1 == "veda" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-bootstrap"
    cp $CARGO_TARGET_DIR/release/veda-bootstrap $VEDA_BIN/veda
fi

if [ -z $1 ] || [ $1 == "auth" ] || [ $1 == "veda-auth" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-auth"
fi

if [ -z $1 ] || [ $1 == "az-indexer" ] || [ $1 == "veda-az-indexer" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-az-indexer"
fi

if [ -z $1 ] || [ $1 == "input-onto" ] || [ $1 == "veda-input-onto" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-input-onto"
fi

if [ -z $1 ] || [ $1 == "ccus2" ] || [ $1 == "veda-ccus2" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-ccus2"
fi

if [ -z $1 ] || [ $1 == "ontologist" ] || [ $1 == "veda-ontologist" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-ontologist"
fi

if [ -z $1 ] || [ $1 == "ft-indexer" ] || [ $1 == "veda-ft-indexer" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-ft-indexer"
fi

if [ -z $1 ] || [ $1 == "mstorage" ] || [ $1 == "veda-mstorage" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-mstorage"
fi

if [ -z $1 ] || [ $1 == "web-api" ] || [ $1 == "veda-web-api" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-web-api"
fi

