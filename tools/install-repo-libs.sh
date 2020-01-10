#!/bin/bash

TARANTOOL_VER=2.1.2
INSTALL_PATH=$PWD

# Get other dependencies
LIB_NAME[1]="libevent-pthreads-2.0-5"
LIB_NAME[3]="libevent-dev"
LIB_NAME[4]="libssl-dev"
LIB_NAME[5]="libmysqlclient-dev"

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

