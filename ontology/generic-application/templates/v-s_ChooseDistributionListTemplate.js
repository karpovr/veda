import IndividualModel from '/js/common/individual_model.js';
import {clear} from '/js/browser/dom_helpers.js';
import CommonUtil from '/js/common/util.js';

export const pre = async function (individual, template, container, mode, extra) {
  const select = template.querySelector('.select-list');
  select.addEventListener('change', async () => {
    try {
      veda.user.aspect['v-s:chosenDistributionList'] = select.value;
      await veda.user.aspect.save();
    } catch (error) {
      console.error('Ошибка при сохранении выбранного списка рассылки:', error);
      alert('Произошла ошибка при сохранении выбранного списка рассылки. Пожалуйста, попробуйте еще раз.');
    }
  });

  async function populateSelect () {
    try {
      clear(select);
      const lists = individual['v-s:hasDistributionList'];
      for (const list of lists) {
        await list.load();
        const option = document.createElement('option');
        option.value = list.id;
        option.label = list['rdfs:label'].map(CommonUtil.formatValue).filter(Boolean);
        if (individual.hasValue('v-s:chosenDistributionList', list.id)) {
          option.selected = true;
        }
        select.appendChild(option);
      }
      if (!individual.hasValue('v-s:chosenDistributionList')) {
        individual['v-s:chosenDistributionList'] = individual['v-s:hasDistributionList'][0];
      }
    } catch (error) {
      console.error('Ошибка при заполнении списка выбора:', error);
      alert('Произошла ошибка при заполнении списка выбора. Пожалуйста, попробуйте еще раз.');
    }
  }

  individual.on('v-s:hasDistributionList', populateSelect);
  template.addEventListener('remove', () => individual.off('v-s:hasDistributionList', populateSelect));
  populateSelect();

  function toggleChosenButtons () {
    const buttons = template.querySelectorAll('.select-list, .edit, .delete');
    if (individual.hasValue('v-s:hasDistributionList')) {
      buttons.forEach((button) => button.classList.remove('hide'));
    } else {
      buttons.forEach((button) => button.classList.add('hide'));
    }
  }

  individual.on('v-s:hasDistributionList', toggleChosenButtons);
  template.addEventListener('remove', () => individual.off('v-s:hasDistributionList', toggleChosenButtons));
  toggleChosenButtons();
};

export const post = async function (individual, template, container, mode, extra) {
  const select = template.querySelector('.select-list');
  template.querySelector('button.create').addEventListener('click', () => {
    const {target, rel} = extra;
    const distributionList = new IndividualModel();
    distributionList['rdf:type'] = 'v-s:DistributionList';
    distributionList['rdfs:label'] = 'Новый список';
    distributionList['v-s:hasItem'] = target[rel].slice();
    editList(distributionList);
  });
  template.querySelector('button.edit').addEventListener('click', () => {
    const distributionListUri = select.value;
    const distributionList = new IndividualModel(distributionListUri);
    editList(distributionList);
  });
  template.querySelector('button.delete').addEventListener('click', async () => {
    const distributionListUri = select.value;
    const distributionList = new IndividualModel(distributionListUri);
    try {
      await veda.user.aspect.removeValue('v-s:hasDistributionList', distributionList);
      await veda.user.aspect.removeValue('v-s:chosenDistributionList', distributionList);
      await veda.user.aspect.save();
      await distributionList.remove();
    } catch (error) {
      console.error('Ошибка при удалении списка рассылки:', error);
      alert('Произошла ошибка при удалении списка рассылки. Пожалуйста, попробуйте еще раз.');
    }
  });

  const modal = $('#confirm-modal-template').html();
  const tmpl = 'v-s:DistributionListTemplate';

  function editList (distributionList) {
    const $modal = $(modal);
    const cntr = $('.modal-body', $modal);
    $modal.on('hidden.bs.modal', () => $modal.remove());
    $modal.modal();
    $('body').append($modal);
    distributionList.present(cntr, tmpl, 'edit').then(() => {
      $('.modal-footer > .ok', $modal).on('click', async () => {
        try {
          await distributionList.save();
          if (!veda.user.aspect.hasValue('v-s:hasDistributionList', distributionList)) {
            await veda.user.aspect.addValue('v-s:hasDistributionList', distributionList);
            await veda.user.aspect.save();
          }
          select.querySelector(`[value="${distributionList.id}"]`).label = distributionList['rdfs:label'].map(CommonUtil.formatValue).filter(Boolean);
        } catch (error) {
          console.error('Ошибка при сохранении списка рассылки:', error);
          alert('Произошла ошибка при сохранении списка рассылки. Пожалуйста, попробуйте еще раз.');
        }
      });
      $('.modal-footer > .cancel', $modal).on('click', async () => {
        await distributionList.reset();
      });
    });
  }
};

export const html = `
<div>
  <h4 class="text-center">
    <i class="fa fa-bars text-muted margin-md-h"></i><span about="v-s:DistributionList" property="rdfs:label"></span>
  </h4>
  <em>Выберите список</em>
  <select class="select-list form-control"></select>
  <div class="margin-md">
    <button class="btn btn-default edit" about="v-s:Edit" property="rdfs:label"></button>
    <button class="btn btn-link delete" about="v-s:Delete" property="rdfs:label"></button>
    <button class="btn btn-success create" about="v-s:Create" property="rdfs:label"></button>
  </div>
</div>
`;
