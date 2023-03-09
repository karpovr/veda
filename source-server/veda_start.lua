-- create simlink to /usr/share/tarantool

local function start()

log = require('log')

memtx = false

if box.space.INDIVIDUALS == nil then

    if memtx then
        space = box.schema.space.create('INDIVIDUALS')
    else
        space = box.schema.space.create('INDIVIDUALS', {engine='vinyl'})
    end.

    print ('space.individuals:', space.id, '\n')

    box.space.INDIVIDUALS:create_index('primary', {parts={1, 'string'}})
    box.schema.user.grant('guest', 'read,write', 'space', 'INDIVIDUALS')
    box.schema.user.grant('guest', 'read,write', 'universe')

    box.schema.user.create('veda6', {password = '123456'}, {if_not_exists = false})
    box.schema.user.grant('veda6', 'read,write,execute', 'universe')

end

if box.space.TICKETS == nil then

    if memtx then
        space = box.schema.space.create('TICKETS')
    else
        space = box.schema.space.create('TICKETS', {engine='vinyl'})
    end

    print ('space.tickets:', space.id, '\n')

    box.space.TICKETS:create_index('primary', {parts={1, 'string'}})
    box.schema.user.grant('guest', 'read,write', 'space', 'TICKETS')
end

print('ready\n')

end

return {
  start = start;
}