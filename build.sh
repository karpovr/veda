build_server_module () {
    BUILD_PATH=$PWD
    VEDA_BIN=$BUILD_PATH/bin
    module_name=$1

    echo $module_name
    rm ./$module_name

    cd source/$module_name
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

if [ -z $1 ] || [ $1 == "az" ] || [ $1 == "veda-az" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then

    build_server_module "libauthorization"

    mkdir $VEDA_BIN/lib
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/libauthorization.so ./source/lib64/libauthorization.so
    cp $CARGO_TARGET_DIR/release/libauthorization.a ./source/lib64/libauthorization.a
    cp $CARGO_TARGET_DIR/release/libauthorization.so $VEDA_BIN/lib

    build_server_module "libvqueueinfo2c"

    cp $CARGO_TARGET_DIR/release/libvqueueinfo2c.so ./source/lib64/libvqueueinfo2c.so
    cp $CARGO_TARGET_DIR/release/libvqueueinfo2c.a ./source/lib64/libvqueueinfo2c.a
    cp $CARGO_TARGET_DIR/release/libvqueueinfo2c.so $VEDA_BIN/lib

fi

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

if [ -z $1 ] || [ $1 == "ccus" ] || [ $1 == "veda-ccus" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-ccus"
fi

if [ -z $1 ] || [ $1 == "ontologist" ] || [ $1 == "veda-ontologist" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-ontologist"
fi

if [ $1 == "geo-indexer" ] || [ $1 == "veda-geo-indexer" ] || [ $1 == "all" ] ; then
    build_server_module "veda-geo-indexer"
fi

if [ $1 == "webserver" ] || [ $1 == "veda-webserver" ] ; then
    build_server_module "veda-webserver"
fi

if [ -z $1 ] || [ $1 == "mstorage" ] || [ $1 == "veda-mstorage" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-mstorage"
fi

if [ -z $1 ] || [ $1 == "ro-storage" ] || [ $1 == "veda-ro-storage" ] || [ $1 == "basic" ] || [ $1 == "all" ] ; then
    build_server_module "veda-ro-storage"
fi

if [ $1 == "fanout-email" ] || [ $1 == "veda-fanout-email" ] || [ $1 == "all" ]; then
    build_server_module "veda-fanout-email"
fi

if [ $1 == "fanout-sql" ] || [ $1 == "veda-fanout-sql" ] || [ $1 == "all" ]; then
    build_server_module "veda-fanout-sql"
fi

if [ $1 == "search-index-tt" ] || [ $1 == "veda-search-index-tt" ] || [ $1 == "all" ]; then
    build_server_module "veda-search-index-tt"
fi

if [ $1 == "search-index-pt" ] || [ $1 == "veda-search-index-pt" ] || [ $1 == "all" ]; then
    build_server_module "veda-search-index-pt"
fi

if [ $1 == "search-query" ] || [ $1 == "veda-search-query" ] || [ $1 == "all" ]; then
    build_server_module "veda-search-query"
fi

if [ $1 == "tools" ] || [ $1 == "veda-tools" ] || [ $1 == "all" ]; then
    build_server_module "veda-tools"
fi

if [ -z $1 ] || [ $1 == "scripts-v8" ] || [ $1 == "veda-scripts-v8" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-scripts-v8"
fi

if [ -z $1 ] || [ $1 == "ft-indexer" ] || [ $1 == "veda-ft-indexer" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-ft-indexer"
fi

if [ -z $1 ] || [ $1 == "sparql-indexer" ] || [ $1 == "sparql-ft-indexer" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-sparql-indexer"
fi

if [ -z $1 ] || [ $1 == "ft-query" ] || [ $1 == "veda-ft-query" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-ft-query"
fi

if [ -z $1 ] || [ $1 == "web-api" ] || [ $1 == "veda-web-api" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    build_server_module "veda-web-api"
fi

if [ -z $1 ] || [ $1 == "queue2storage" ] || [ $1 == "veda-queue2storage" ] || [ $1 == "all" ]; then
    build_server_module "veda-queue2storage"
fi

if [ -z $1 ] || [ $1 == "gowebserver" ] || [ $1 == "veda-gowebserver" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then

    if [ -z $GOROOT ]; then
	export GOROOT=/usr/local/go
    else 
	echo "var GOROOT is set to '$GOROOT'"; 
    fi

    export PATH=$PATH:$GOROOT/bin:$GOPATH/bin
    export GOPATH=$HOME/go

    echo build gowebserver
    cd source/veda-gowebserver
    go build
    cd $BUILD_PATH
    mv source/veda-gowebserver/veda-gowebserver $VEDA_BIN/veda-gowebserver
fi

if [ -z $1 ] || [ $1 == "web" ] || [ $1 == "public" ] || [ $1 == "all" ]; then
    echo BUILD PUBLIC

    cd source-web
    npm install
    npm run build
    cd $BUILD_PATH
fi

