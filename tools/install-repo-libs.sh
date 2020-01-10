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

### TARANTOOL SERVER ###

if [ "$1" = tarantool ] || [ "$1" = force ] || ! tarantool -V | grep $TARANTOOL_VER ; then
echo "--- INSTALL TARANTOOL ---"
curl http://download.tarantool.org/tarantool/2x/gpgkey | sudo apt-key add -
release=`lsb_release -c -s`

# install https download transport for APT
sudo apt-get -y install apt-transport-https

# append two lines to a list of source repositories
sudo rm -f /etc/apt/sources.list.d/*tarantool*.list
sudo tee /etc/apt/sources.list.d/tarantool_1_0.list <<- EOF
deb http://download.tarantool.org/tarantool/2x/ubuntu/ $release main
deb-src http://download.tarantool.org/tarantool/2x/ubuntu/ $release main
EOF

# install
sudo apt-get update
sudo apt-get remove tarantool
sudo apt-get remove tarantool-dev
sudo apt-get -y install tarantool
sudo apt-get -y install tarantool-dev

tarantool -V

else
    echo "--- TARANTOOL INSTALLED ---"
fi

