#!/usr/bin/env tarantool
-- create simlink to /etc/tarantool/instances.enabled

box.cfg {
force_recovery = true;
listen=3309;
vinyl_dir = '/opt/tarantool';
work_dir  = '/opt/tarantool';
wal_dir   = "/opt/tarantool";
memtx_dir = "/opt/tarantool";
--vinyl_cache = 128;
--vinyl_memory = 100 * 1024 * 1024;
log_level=5;
log='/opt/tarantool/tarantool.log';
--readahead = 10 * 1024 * 1024;
}

-- load my_app module and call start() function
-- with some app options controlled by sysadmins
local m = require('veda_start').start({...})
