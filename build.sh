BUILD_PATH=$PWD

#!/bin/sh
rm *.log
rm ./logs/*.log
rm -r ./logs

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
    echo BUILD AZ

    cd source/libauthorization
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/libauthorization.so ./source/lib64/libauthorization.so
    cp $CARGO_TARGET_DIR/release/libauthorization.a ./source/lib64/libauthorization.a
    cp $CARGO_TARGET_DIR/release/libauthorization.so $PWD
    sudo cp $CARGO_TARGET_DIR/release/libauthorization.so /usr/local/lib
    sudo ldconfig

fi

if [ $1 == "winpak" ] || [ $1 == "veda-winpak" ] || [ $1 == "all" ] ; then
    echo BUILD WINPAK

    rm ./veda-winpak

    cd source/veda-winpak
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-winpak $PWD

fi

if [ -z $1 ] || [ $1 == "auth" ] || [ $1 == "veda-auth" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    echo BUILD AUTH
    rm ./veda-auth

    cd source/veda-auth
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-auth $PWD

fi

if [ -z $1 ] || [ $1 == "az-indexer" ] || [ $1 == "veda-az-indexer" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    echo BUILD AZ_INDEXER

    rm ./veda-az-indexer

    cd source/veda-az-indexer
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-az-indexer $PWD

fi

if [ $1 == "exim-inquire" ] || [ $1 == "veda-exim-inquire" ] || [ $1 == "exim" ] || [ $1 == "all" ]; then
    echo BUILD EXIM-INQUIRE
    rm ./veda-exim-inquire

    cd source/veda-exim-inquire
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-exim-inquire $PWD

fi

if [ $1 == "exim-respond" ] || [ $1 == "veda-exim-respond" ] || [ $1 == "exim" ] || [ $1 == "all" ]; then
    echo BUILD EXIM-RESPOND

    rm ./veda-exim-respond
    cd source/veda-exim-respond

    cargo +nightly build --release

    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-exim-respond $PWD

fi

if [ $1 == "extractor" ] || [ $1 == "veda-extractor" ] || [ $1 == "exim" ] || [ $1 == "all" ]; then
    echo BUILD VEDA-EXTRACTOR
    rm ./veda-extractor

    cd source/veda-extractor
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-extractor $PWD
fi

if [ -z $1 ] || [ $1 == "input-onto" ] || [ $1 == "veda-input-onto" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    echo BUILD INPUT-ONTO

    rm ./veda-input-onto

    cd source/veda-input-onto
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-input-onto $PWD

fi

if [ -z $1 ] || [ $1 == "ccus" ] || [ $1 == "veda-ccus" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    echo BUILD CCUS
    rm ./veda-ccus

    cd source/veda-ccus
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-ccus $PWD
fi

if [ -z $1 ] || [ $1 == "ontologist" ] || [ $1 == "veda-ontologist" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    echo BUILD ONTOLOGIST
    rm ./veda-ontologist

    cd source/veda-ontologist
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-ontologist $PWD
fi

if [ $1 == "geo-indexer" ] || [ $1 == "veda-geo-indexer" ] || [ $1 == "all" ] ; then

    echo start make VEDA-GEO-INDEXER
    rm ./veda-geo-indexer

    cd source/veda-geo-indexer
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-geo-indexer $PWD

    echo end make VEDA-GEO-INDEXER
fi

if [ $1 == "webserver" ] || [ $1 == "veda-webserver" ] ; then
    echo BUILD VEDA-WEBSERVER
    rm ./veda-webserver

    cd source/veda-webserver
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-webserver $PWD
fi

if [ -z $1 ] || [ $1 == "bootstrap" ] || [ $1 == "veda" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    echo BUILD VEDA-BOOTSTRAP
    rm ./veda

    cd source/veda-bootstrap
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-bootstrap $PWD/veda
fi

if [ -z $1 ] || [ $1 == "mstorage" ] || [ $1 == "veda-mstorage" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    echo BUILD MSTORAGE
    cd source/veda-mstorage
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-mstorage $PWD

fi

if [ -z $1 ] || [ $1 == "ro-storage" ] || [ $1 == "veda-ro-storage" ] || [ $1 == "basic" ] || [ $1 == "all" ] ; then
    echo BUILD RO-STORAGE
    cd source/veda-ro-storage
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-ro-storage $PWD

fi

if [ $1 == "fanout-email" ] || [ $1 == "veda-fanout-email" ] || [ $1 == "all" ]; then
    echo BUILD FANOUT-EMAIL
    cd source/veda-fanout-email
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-fanout-email $PWD
fi

if [ $1 == "fanout-sql" ] || [ $1 == "veda-fanout-sql" ] || [ $1 == "all" ]; then
    echo BUILD FANOUT-SQL
    cd source/veda-fanout-sql
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-fanout-sql $PWD
fi

if [ $1 == "search-index-tt" ] || [ $1 == "veda-search-index-tt" ] || [ $1 == "all" ]; then
    echo BUILD TT
    cd source/veda-search-index-tt
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-search-index-tt $PWD
fi

if [ $1 == "search-index-pt" ] || [ $1 == "veda-search-index-pt" ] || [ $1 == "all" ]; then
    echo BUILD PT
    cd source/veda-search-index-pt
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-search-index-pt $PWD
fi

if [ $1 == "search-query" ] || [ $1 == "veda-search-query" ] || [ $1 == "all" ]; then
    echo BUILD SEARCH-QUERY
    cd source/veda-search-query
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-search-query $PWD
fi

if [ $1 == "cleaner" ] || [ $1 == "veda-cleaner" ] || [ $1 == "all" ]; then
    echo BUILD CLEANER
    cd source/veda-cleaner
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-cleaner $PWD
fi

if [ -z $1 ] || [ $1 == "scripts-v8" ] || [ $1 == "veda-scripts-v8" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    echo BUILD SCRIPTS-V8
    cd source/veda-scripts-v8
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-scripts-v8 $PWD
fi

if [ $1 == "nano-bpmn" ] || [ $1 == "veda-nano-bpmn" ] || [ $1 == "all" ]; then
    echo BUILD nano-bpmn
    cd source/veda-nano-bpmn
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-nano-bpmn $PWD
fi

if [ $1 == "camunda-external-task" ] || [ $1 == "veda-camunda-external-task" ] || [ $1 == "all" ]; then
    echo BUILD camunda-external-task
    cd source/veda-camunda-external-task
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-camunda-external-task $PWD
fi


if [ $1 == "camunda-connector" ] || [ $1 == "veda-camunda-connector" ] || [ $1 == "all" ]; then
    echo BUILD camunda-connector
    cd source/veda-camunda-connector
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-camunda-connector $PWD
fi

if [ -z $1 ] || [ $1 == "ft-indexer" ] || [ $1 == "veda-ft-indexer" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    echo BUILD FT-INDEXER
    cd source/veda-ft-indexer
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-ft-indexer $PWD/veda-ft-indexer
fi

if [ -z $1 ] || [ $1 == "ft-query" ] || [ $1 == "veda-ft-query" ] || [ $1 == "basic" ] || [ $1 == "all" ]; then
    echo BUILD FT-QUERY
    cd source/veda-ft-query
    cargo build --release
    cd $BUILD_PATH
    cp $CARGO_TARGET_DIR/release/veda-ft-query $PWD/veda-ft-query
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
    cp source/veda-gowebserver/veda-gowebserver ./veda-gowebserver
fi
