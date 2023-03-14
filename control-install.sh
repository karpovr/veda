#!/bin/bash
# скрипт устанавливает среду для последующей компиляции, берет исходники зависимостей из github, но не собирает

INSTALL_PATH=$PWD

cd ./source-server
git submodule update
./control-install.sh
cd $INSTALL_PATH

./tools/install-repo-libs.sh

# Get other dependencies
LIB_NAME[5]="libglib2.0-dev"
LIB_NAME[6]="cmake"
LIB_NAME[7]="libtool-bin"
LIB_NAME[8]="pkg-config"
LIB_NAME[9]="build-essential"
LIB_NAME[10]="autoconf"
LIB_NAME[11]="automake"
LIB_NAME[12]="curl"
LIB_NAME[13]="python"
# LIB_NAME[14]="npm"

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
