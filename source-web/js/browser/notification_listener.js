// Listen to client notifications

import veda from '../common/veda.js';

import Util from '../common/util.js';

import IndividualModel from '../common/individual_model.js';

veda.on('started', () => {
  const clientNotification = new IndividualModel('cfg:ClientNotification');
  clientNotification.load().then((clientNotification) => {
    clientNotification.on('afterReset', checkNotification);
    checkNotification.call(clientNotification);
  });

  /**
   * Check received notification
   * @this Individual
   * @return {void}
   */
  function checkNotification () {
    const clientNotification = this;
    let browserNotificationList;
    try {
      browserNotificationList = JSON.parse(localStorage.clientNotification);
    } catch (error) {
      browserNotificationList = [];
    }
    const serverNotificationList = clientNotification.get('rdf:value').map((item) => item.id);
    if (!Util.areEqual(browserNotificationList, serverNotificationList) && serverNotificationList.length) {
      serverNotificationList.reduce((p, notification_uri) => p.then(() => {
        if (browserNotificationList.indexOf(notification_uri) >= 0) {
          return;
        }
        const notification = new IndividualModel(notification_uri);
        return notification.load().then((notification) => (notification.properties['v-s:newsAudience'] || []).map((audience) => audience.data)).then((audience) => {
          audience = audience.sort();
          return veda.user.memberOf().then((memberOf) => {
            memberOf = memberOf.sort();
            let i = 0;
            let j = 0;
            let audience_uri; let memberOf_uri;
            while ((audience_uri = audience[i]) && (memberOf_uri = memberOf[j])) {
              if (memberOf_uri < audience_uri) {
                j++;
              } else if (memberOf_uri > audience_uri) {
                i++;
              } else {
                return Util.confirm(notification).then((confirmed) => {
                  if (confirmed) {
                    localStorage.clientNotification = JSON.stringify(serverNotificationList);
                    if (notification.hasValue('v-s:script')) {
                      const script = notification.get('v-s:script')[0].toString();
                      const fn = new Function('veda', script);
                      return fn(veda);
                    }
                  }
                });
              }
            }
          });
        });
      }).catch(console.log), Promise.resolve());
    } else {
      localStorage.clientNotification = JSON.stringify(serverNotificationList);
    }
  }
});
