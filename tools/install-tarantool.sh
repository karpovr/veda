#!/bin/bash

# install these utilities if they are missing
apt-get -y install sudo
sudo apt-get -y install gnupg2
sudo apt-get -y install curl

curl http://download.tarantool.org/tarantool/2x/gpgkey | sudo apt-key add -

# install the lsb-release utility and use it to identify the current OS code name;
# alternatively, you can set the OS code name manually, e.g. xenial or bionic
sudo apt-get -y install lsb-release
release=`lsb_release -c -s`

# install https download transport for APT
sudo apt-get -y install apt-transport-https

# append two lines to a list of source repositories
sudo rm -f /etc/apt/sources.list.d/*tarantool*.list
echo "deb http://download.tarantool.org/tarantool/2x/ubuntu/ ${release} main" | sudo tee /etc/apt/sources.list.d/tarantool_2x.list
echo "deb-src http://download.tarantool.org/tarantool/2x/ubuntu/ ${release} main" | sudo tee -a /etc/apt/sources.list.d/tarantool_2x.list

# install tarantool
sudo apt-get -y update
sudo apt-get -y install tarantool
