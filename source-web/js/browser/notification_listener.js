// Listen to client notifications

import veda from '../common/veda.js';

import Util from '../browser/util.js';

import IndividualModel from '../common/individual_model.js';

veda.one('started', () => {
  const serverNotification = new IndividualModel('cfg:ClientNotification');
  serverNotification.reset().then(() => {
    serverNotification.on('afterReset', checkNotification);
    checkNotification.call(serverNotification);
  });
});

/**
 * Check received notification
 * @this {IndividualModel}
 * @return {void}
 */
async function checkNotification () {
  const serverNotification = this;
  const userGroups = await veda.user.memberOf();
  let clientNotification = localStorage.notification;
  if (!clientNotification) {
    clientNotification = await serverNotification.clone();
    clientNotification.clearValue('rdf:value');
  } else {
    clientNotification = new IndividualModel(JSON.parse(clientNotification));
  }
  for (const notification of serverNotification['rdf:value']) {
    if (clientNotification.hasValue('rdf:value', notification)) continue;
    await notification.load();
    const audience = notification.hasValue('v-s:newsAudience') ? notification['v-s:newsAudience'] : [new IndividualModel('cfg:AllUsersGroup')];
    for (const group of audience) {
      if (userGroups.indexOf(group.id) >= 0) {
        const confirmed = await Util.confirm(notification);
        if (!confirmed) {
          return;
        }
        clientNotification.addValue('rdf:value', notification);
        localStorage.notification = JSON.stringify(clientNotification.properties);
        if (notification.hasValue('v-s:script')) {
          eval(notification['v-s:script'][0].toString());
        }
      }
    }
  }
  clientNotification['rdf:value'] = serverNotification['rdf:value'];
  localStorage.notification = JSON.stringify(clientNotification.properties);
}
