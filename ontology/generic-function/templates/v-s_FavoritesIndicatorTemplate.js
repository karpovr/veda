import $ from 'jquery';
import veda from '/js/common/veda.js';
import Sha256 from 'sha256';
import IndividualModel from '/js/common/individual_model.js';
import riot from 'riot';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  template
    .tooltip({
      container: template,
      placement: 'bottom',
      trigger: 'hover',
      title: (function () {
        let titleStr;
        return function () {
          getCurrent().then(function (current) {
            const title = veda.user.aspect.hasValue('v-s:hasFavorite', current) ?
              new IndividualModel('v-s:RemoveFromFavorites') :
              new IndividualModel('v-s:AddToFavorites');
            title.load().then(function (title) {
              titleStr = title.toString();
              template.find('.tooltip-inner').text(titleStr);
            });
          });
          return titleStr ? titleStr : '...';
        };
      })(),
    })
    .click(function (e) {
      e.preventDefault();
      getCurrent(location.hash)
        .then(function (current) {
          if (!current) {
            return;
          }
          const subscriptionId = 'd:' + Sha256.hash(veda.user_uri + current.id).substr(0, 32);
          if (veda.user.aspect.hasValue('v-s:hasFavorite', subscriptionId)) {
            veda.user.aspect.removeValue('v-s:hasFavorite', new IndividualModel(subscriptionId));
            indicateFavorite(current);
            return new IndividualModel(subscriptionId).remove();
          } else {
            const subscription = new IndividualModel();
            subscription.id = subscriptionId;
            subscription['rdf:type'] = [new IndividualModel('v-s:Subscription')];
            subscription['v-s:onDocument'] = [current];
            subscription['v-s:creator'] = [veda.user];
            veda.user.aspect.addValue('v-s:hasFavorite', subscription);
            indicateFavorite(current);
            return subscription.save();
          }
        })
        .then(function () {
          veda.user.aspect.save();
        })
        .catch(function (e) {
          console.log(e);
        });
    });

  riot.route(function (hash) {
    getCurrent(hash).then(indicateFavorite);
  });

  function indicateFavorite (current) {
    current &&
      current
        .load()
        .then(function (current) {
          return current.is('v-s:Journaling');
        })
        .then(function (isJournaling) {
          if (isJournaling) {
            const subscriptionId = 'd:' + Sha256.hash(veda.user_uri + current.id).substr(0, 32);
            template.show();
            if (veda.user.aspect.hasValue('v-s:hasFavorite', subscriptionId)) {
              template.addClass('fa-star').removeClass('fa-star-o');
            } else {
              template.removeClass('fa-star').addClass('fa-star-o');
            }
          } else {
            template.hide();
          }
        });
  }

  function getCurrent (hash) {
    return new Promise(function (resolve) {
      const current_uri = hash ? decodeURI(hash).slice(2).split('/')[0] : '';
      const re = /^(\w|-)+:.*?$/;
      if (re.test(current_uri)) {
        resolve(new IndividualModel(current_uri).load());
      } else {
        resolve();
      }
    }).then(function (current) {
      if (!current) {
        return;
      }
      const isTask = current.hasValue('rdf:type', 'v-wf:DecisionForm');
      if (isTask) {
        current = current['v-wf:onDocument'][0];
      }
      return current;
    });
  }
};

export const html = `
  <a href="#" class="fa fa-lg" style="display:none;"></a>
`;
