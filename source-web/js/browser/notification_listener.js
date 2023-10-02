// Listen to client notifications

import veda from '../common/veda.js';
import Util from '../browser/util.js';
import {timeout} from '../browser/dom_helpers.js';
import IndividualModel from '../common/individual_model.js';
import Backend from '../common/backend.js';
import UpdateService from '../browser/update_service.js';

const updateService = new UpdateService();

veda.one('started', () => {
  updateService.subscribe(document, ['cfg:ClientNotification', 0, checkNotification]);
});

/**
 * Check received notification
 * @this {IndividualModel}
 * @return {void}
 */
async function checkNotification () {
  await timeout(Math.round(Math.random() * 60 * 1000));
  const serverNotification = await Backend.get_individual(veda.ticket, 'cfg:ClientNotification', false);
  const userGroups = await veda.user.memberOf();
  let clientNotification = localStorage.notification;
  if (!clientNotification) {
    clientNotification = {...serverNotification};
    clientNotification['rdf:value'] = [];
  } else {
    clientNotification = JSON.parse(clientNotification);
  }
  const clientNews = clientNotification['rdf:value']?.map((value) => value.data) ?? [];
  const serverNews = serverNotification['rdf:value']?.map((value) => value.data) ?? [];
  for (const newsId of serverNews) {
    if (clientNews.indexOf(newsId) >= 0) continue;
    const news = new IndividualModel(newsId);
    await news.load();
    const audience = news.hasValue('v-s:newsAudience') ? news['v-s:newsAudience'] : [new IndividualModel('cfg:AllUsersGroup')];
    for (const group of audience) {
      if (userGroups.indexOf(group.id) >= 0) {
        const confirmed = await Util.confirm(news);
        if (!confirmed) {
          return;
        }
        clientNotification['rdf:value'] = clientNotification['rdf:value']?.concat({data: news.id, type: 'Uri'}) ?? [{data: news.id, type: 'Uri'}];
        localStorage.notification = JSON.stringify(clientNotification);
        if (news.hasValue('v-s:script')) {
          eval(news['v-s:script'][0].toString());
        }
      }
    }
  }
  localStorage.notification = JSON.stringify(serverNotification);
}
