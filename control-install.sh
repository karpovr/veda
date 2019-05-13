#!/bin/bash
# скрипт устанавливает среду для последующей компиляции, берет исходники зависимостей из github, но не собирает

./tools/install-repo-libs.sh

DMD_VER=2.080.0
DUB_VER=1.5.0
GO_VER=go1.12.1
MSGPUCK_VER=2.0
NANOMSG_VER=1.1.5
LMDB_VER=0.9.22
XAPIAND_VER=1.0.0

INSTALL_PATH=$PWD

# Get other dependencies
LIB_NAME[6]="cmake"
LIB_NAME[7]="libtool-bin"
LIB_NAME[8]="pkg-config"
LIB_NAME[9]="build-essential"
LIB_NAME[10]="autoconf"
LIB_NAME[11]="automake"
LIB_NAME[12]="curl"

LIB_OK="Status: install ok installed"
F_UL=0

### LIBS FROM APT ###

for i in "${LIB_NAME[@]}"; do

    L1=`dpkg -s $i | grep 'install ok'`

    echo CHECK $i .... $L1

    if  [ "$L1" != "$LIB_OK" ]; then

      if [ $F_UL == 0 ]; then
          sudo apt-get update
          F_UL=1
      fi

		echo INSTALL $i
        sudo apt-get install -y $i
    fi

done

sudo apt-get install build-essential

### RUST LANG ###

if [ "$1" = force ] || ! rustc -V ; then
    echo "--- INSTALL RUST ---"
    curl https://sh.rustup.rs -sSf | sh -s -- -y
    source $HOME/.cargo/env
else
    echo "--- UPDATE RUST ---"
    rustup update stable
fi

whereis rustc
rustc -V
cargo -V

### D LANG ###

# Get right version of DMD
if [ "$1" = force ] || ! dmd --version | grep $DMD_VER ; then
    echo "--- INSTALL DMD ---"
    wget -w 10 http://downloads.dlang.org/releases/2.x/$DMD_VER/dmd_$DMD_VER-0_amd64.deb
    sudo dpkg -i dmd_$DMD_VER-0_amd64.deb
    rm dmd_$DMD_VER-0_amd64.deb
    rm -r ~/.dub
else
    echo "--- DMD INSTALLED ---"
fi

# Get right version of DUB
if [ "$1" = force ] || ! dub --version | grep $DUB_VER ; then
    echo "--- INSTALL DUB ---"
    wget https://github.com/dlang/dub/releases/download/v$DUB_VER/dub-$DUB_VER-linux-x86_64.tar.gz
    tar -xvzf dub-$DUB_VER-linux-x86_64.tar.gz
    sudo cp ./dub /usr/bin/dub
    rm dub-$DUB_VER-linux-x86_64.tar.gz
    rm dub
else
    echo "--- DUB INSTALLED ---"
fi

### GO LANG ###
if [ "$1" = force ] || ! go version | grep $GO_VER ; then
    echo "--- INSTALL GOLANG ---"
    mkdir tmp
    cd tmp
    wget https://storage.googleapis.com/golang/$GO_VER.linux-amd64.tar.gz
    tar -xf $GO_VER.linux-amd64.tar.gz

    if env | grep -q ^GOROOT=
    then
        sudo rm -rf $GOROOT
    else
        export GOROOT=/usr/local/go
        export PATH="$PATH:$GOROOT/bin:$GOPATH/bin"
        echo 'export GOROOT=/usr/local/go'  >> $HOME/.profile
        echo 'export PATH=$PATH:$GOROOT/bin:$GOPATH/bin'  >> $HOME/.profile
    fi

    export GOPATH=$HOME/go
    echo 'export GOPATH=$HOME/go'  >> $HOME/.bashrc
    source ~/.bashrc

    sudo rm -rf /usr/local/go
    sudo rm -rf /usr/bin/go
    sudo rm -rf /usr/bin/gofmt
    sudo mv go $GOROOT

    go version
    cd ..
else
    echo "--- GOLANG INSTALLED ---"
fi

#lmdb-go
#go get -v github.com/muller95/lmdb-go/lmdb
go get github.com/itiu/lmdb-go/lmdb

#fasthttp
go get -v github.com/itiu/fasthttp

#go-nanomsg
go get -v github.com/op/go-nanomsg

go get github.com/tarantool/go-tarantool
go get github.com/gorilla/websocket
go get github.com/divan/expvarmon
go get -v gopkg.in/vmihailenco/msgpack.v2
cp -a ./source/golang-third-party/cbor $GOPATH/src
ls $HOME/go/src

### LIB NANOMSG ###

if ([ "$1" = force ] ||  [ "$1" = force-nanomsg ]) || ! ldconfig -p | grep libnanomsg ; then
    echo "--- INSTALL NANOMSG ---"
    # make nanomsg dependency
    TRAVIS_TAG=$NANOMSG_VER
    mkdir tmp
    wget https://github.com/nanomsg/nanomsg/archive/$NANOMSG_VER.tar.gz -P tmp
    cd tmp
    tar -xvzf $NANOMSG_VER.tar.gz
    cd nanomsg-$NANOMSG_VER
    mkdir build
    cd build
    cmake ..
    make
    sudo make install

    echo '/usr/local/lib/x86_64-linux-gnu' > x86_64-linux-gnu-local.conf
    sudo cp x86_64-linux-gnu-local.conf /etc/ld.so.conf.d/x86_64-linux-gnu-local.conf
    sudo ldconfig

    cd ..
    cd ..
    cd ..
else
    echo "--- NANOMSG INSTALLED ---"
fi

### LIB RAPTOR ###

sudo apt-get remove -y libraptor2-0
ldconfig -p | grep libraptor2
if [ "$1" = force ] || ! ldconfig -p | grep libraptor2 ; then
    echo "--- INSTALL LIB RAPTOR ---"
    sudo apt-get install -y gtk-doc-tools
    sudo apt-get install -y libxml2-dev
    sudo apt-get install -y flex
    sudo apt-get install -y bison

    mkdir tmp
    cd tmp

    wget https://github.com/dajobe/raptor/archive/raptor2_2_0_15.tar.gz -P .
    tar -xvzf raptor2_2_0_15.tar.gz

    cd raptor-raptor2_2_0_15
    autoreconf -i
    ./autogen.sh
    ./make
    sudo make install
    sudo ldconfig
    cd ..
    cd ..
    cd ..

else
    echo "--- LIB RAPTOR INSTALLED ---"
fi

if [ "$1" = force ] || [ "$1" = force-tarantool ] || ! ldconfig -p | grep libtarantool ; then
    echo "--- INSTALL LIBTARANTOOL ---"
    TTC=d93096a9d39e36c456af82e5e53c6ca4f4be608f

    mkdir tmp
    cd tmp

    wget https://github.com/tarantool/tarantool-c/archive/$TTC.tar.gz -P .
    tar -xvzf $TTC.tar.gz

    wget https://github.com/tarantool/msgpuck/archive/$MSGPUCK_VER.tar.gz -P third_party/msgpuck -P .
    tar -xvzf $MSGPUCK_VER.tar.gz

    cp msgpuck-$MSGPUCK_VER/* tarantool-c-$TTC/third_party/msgpuck
    cd tarantool-c-$TTC

    mkdir build
    cd build
    cmake ..
    make
    sudo make install
    sudo ldconfig

    cd ..
    cd ..

else
    echo "--- LIBTARANTOOL INSTALLED ---"
fi

    echo "--- MAKE LIBAUTHORIZATION ---"

    cd $INSTALL_PATH
    cd source/authorization
    cargo build --release
    cd ..
    cd ..
    sudo cp ./source/lib64/libauthorization.so /usr/local/lib
    sudo ldconfig

### LIB LMDB ###

    echo "--- INSTALL LIBLMDB ---"
    # make liblmdb dependency
    mkdir tmp
    wget https://github.com/itiu/lmdb/archive/$LMDB_VER.tar.gz -P tmp
    cd tmp
    tar -xvzf $LMDB_VER.tar.gz
    cd lmdb-$LMDB_VER/libraries/liblmdb
    make
    cd ..
    cd ..
    cd ..
    cd ..
    cp ./tmp/lmdb-$LMDB_VER/libraries/liblmdb/liblmdb.a ./source/lib64


### libv8d ###
    cd ./source/lib64/ext-lib-bind-src/v8_d
    make    

#if [ "$1" = force ] || ! ldconfig -p | grep libxapianm ; then
#
#    echo "--- INSTALL XAPIAN ---"
#
#    cd source/lib64/libxapianm
#    sudo libtool   --mode=install /usr/bin/install -c   libxapianm.la '/usr/local/lib'
#    sudo ldconfig
#    cd $PWD
#
#else
#
#    echo "--- XAPIAN INSTALLED ---"
#
#fi

### libxapiand ###

    cd $INSTALL_PATH
    echo "--- INSTALL LIBXAPIAN ---"
    mkdir tmp
    wget https://github.com/itiu/xapian-d/archive/v$XAPIAND_VER.tar.gz -P tmp
    cd tmp
    tar -xvzf v$XAPIAND_VER.tar.gz
    cd xapian-d-$XAPIAND_VER
#    ./make-xapian-d.sh
    cd $INSTALL_PATH
    cp ./tmp/xapian-d-$XAPIAND_VER/lib64/libxapiand.a ./source/lib64
