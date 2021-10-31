FROM tarantool/tarantool:2.8.2
COPY init_tarantool.lua /opt/tarantool/init_tarantool.lua
RUN chown tarantool:tarantool /opt/tarantool/init_tarantool.lua
CMD ["tarantool", "/opt/tarantool/init_tarantool.lua"]
