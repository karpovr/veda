import $ from 'jquery';
import veda from '/js/common/veda.js';
import Sha256 from 'sha256';
import IndividualModel from '/js/common/individual_model.js';
import riot from 'riot';

export const pre = async function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  riot.route(indicateFavorite);

  template
    .tooltip({
      container: template,
      placement: 'bottom',
      trigger: 'hover',
      title: async function () {
        const title = template.hasClass('fa-star') ? new IndividualModel('v-s:RemoveFromFavorites') : new IndividualModel('v-s:AddToFavorites');
        await title.load();
        template.find('.tooltip-inner').text(title.toString());
        return title.toString();
      },
    })
    .click(async function (e) {
      e.preventDefault();
      const current = await getCurrent(location.hash);
      if (!current) return;
      const subscriptionId = 'd:' + Sha256.hash(veda.user_uri + current.id).substr(0, 32);
      try {
        if (veda.user.aspect.hasValue('v-s:hasFavorite', subscriptionId)) {
          const subscription = new IndividualModel(subscriptionId);
          await veda.user.aspect.removeValue('v-s:hasFavorite', subscription);
          subscription.remove();
        } else if (await veda.user.aspect.hasChainValue(subscriptionId, 'v-s:hasFavoriteFolder', 'v-s:hasItem')) {
          const subscription = new IndividualModel(subscriptionId);
          await veda.user.aspect['v-s:hasFavoriteFolder'].reduce(async (p, folder) => {
            await p;
            await folder.load();
            await folder.removeValue(undefined, subscription);
            await folder.save();
          }, Promise.resolve());
          await subscription.remove();
        } else {
          const subscription = new IndividualModel();
          subscription.id = subscriptionId;
          subscription['rdf:type'] = [new IndividualModel('v-s:Subscription')];
          subscription['v-s:onDocument'] = [current];
          subscription['v-s:creator'] = [veda.user];
          veda.user.aspect.addValue('v-s:hasFavorite', subscription);
          await subscription.save();
        }
        indicateFavorite();
        await veda.user.aspect.save();
      } catch (error) {
        console.error('Update user aspect failed', error);
      }
    });

  async function indicateFavorite () {
    const current = await getCurrent(location.hash);
    if (!current) return;
    const isJournaling = await current.is('v-s:Journaling');
    if (isJournaling) {
      const subscriptionId = 'd:' + Sha256.hash(veda.user_uri + current.id).substr(0, 32);
      template.show();
      if (
        veda.user.aspect.hasValue('v-s:hasFavorite', subscriptionId) ||
        await veda.user.aspect.hasChainValue(subscriptionId, 'v-s:hasFavoriteFolder', 'v-s:hasItem')
      ) {
        template.addClass('fa-star').removeClass('fa-star-o');
      } else {
        template.removeClass('fa-star').addClass('fa-star-o');
      }
    } else {
      template.hide();
    }
  }

  async function getCurrent (hash) {
    const current_uri = hash ? decodeURI(hash).slice(2).split('/')[0] : '';
    const re = /^(\w|-)+:.*?$/;
    if (!re.test(current_uri)) return;
    let current = new IndividualModel(current_uri);
    await current.load();
    const isTask = current.hasValue('rdf:type', 'v-wf:DecisionForm');
    if (isTask) current = current['v-wf:onDocument'][0];
    return current;
  }
};

export const html = `
  <a href="#" class="fa fa-lg" style="display:none;"></a>
`;
