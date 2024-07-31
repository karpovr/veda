#!/bin/bash

sudo apt-get install -y apt-transport-https ca-certificates dirmngr
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 8919F6BD2B48D754

echo "deb https://packages.clickhouse.com/deb stable main" | sudo tee \
    /etc/apt/sources.list.d/clickhouse.list
sudo apt-get update

sudo apt-get install -y clickhouse-server clickhouse-client

sudo cp -v ./tools/clickhouse/users.xml /etc/clickhouse-server/users.xml

sudo service clickhouse-server start
#clickhouse-client # or "clickhouse-client --password" if you've set up a password.
