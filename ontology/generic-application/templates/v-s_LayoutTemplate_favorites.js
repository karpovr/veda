import CommonUtil from '/js/common/util.js';
import {clear} from '/js/browser/dom_helpers.js';
import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  $(template)
    .tooltip({
      container: template,
      trigger: 'hover',
      placement: 'bottom',
      title: individual['rdfs:label'].map(CommonUtil.formatValue).join(' '),
    })
    .click(showFavoritesDialog);
};

export const html = `
  <a href="#">
    <svg width="23" height="19" style="fill:#555">
      <path d="M 21.62,3.2439024 H 11.766837 L 10.323946,0.70055314 C 10.07812,0.26756032 9.6210169,2.7532047e-4 9.1258802,-2.08554e-8 H 1.38 C 0.61819174,8.376992e-4 8.3153595e-4,0.62278065 0,1.3902439 V 17.609756 C 8.3149267e-4,18.377219 0.61819171,18.999162 1.38,19 h 20.24 c 0.761808,-8.38e-4 1.379169,-0.622781 1.38,-1.390244 V 4.6341463 C 22.999168,3.8666831 22.381808,3.2447401 21.62,3.2439024 Z m 0.0033,13.9091226 c -1.7e-4,0.255866 -0.206019,0.463244 -0.46,0.463415 H 1.8367308 c -0.2539807,-1.71e-4 -0.4598302,-0.207549 -0.46,-0.463415 V 1.8469747 c 1.699e-4,-0.2558659 0.2060195,-0.4632434 0.46,-0.4634147 h 7.2891494 c 0.1649678,-6.02e-5 0.3173406,0.088865 0.3993536,0.2330652 l 1.5754082,2.777318 c 0.0819,0.1443717 0.234297,0.233482 0.399358,0.2335192 h 9.663269 c 0.253981,1.712e-4 0.45983,0.2075488 0.46,0.4634147 z"/>
      <path d="M 12.456756,8.8618134 9.7448226,8.4644724 8.5319266,5.9885496 c -0.168557,-0.3445559 -0.656223,-0.3445559 -0.82478,0 L 6.4938228,8.4644724 3.7818882,8.8618134 C 3.4045963,8.9168234 3.2537803,9.3838589 3.5267308,9.6519689 L 5.4893714,11.579392 5.026225,14.300595 c -0.064582,0.378663 0.3301194,0.667387 0.6675382,0.488304 l 2.4257824,-1.284798 2.4253314,1.284798 c 0.337404,0.178873 0.731926,-0.10972 0.667538,-0.488304 l -0.463142,-2.721203 1.962636,-1.9274231 c 0.27295,-0.268109 0.122137,-0.7351455 -0.255153,-0.7901555 z"/>
    </svg>
  </a>
`;

async function showFavoritesDialog (e) {
  e.preventDefault();
  const container = document.createElement('div');
  container.innerHTML = dialogTemplate;
  document.body.appendChild(container);
  const dialog = container.querySelector('.dialog');
  const favorites = dialog.querySelector('.favorites');
  const cancel = dialog.querySelector('.cancel');
  dialog.addEventListener('close', () => {
    clear(favorites);
    container.remove();
  });
  cancel.addEventListener('click', () => dialog.close());

  try {
    await veda.user.aspect.present(favorites, 'v-s:FavoritesTemplate');
    dialog.showModal();
    dialog.querySelector('.cancel').focus();
  } catch (error) {
    console.log('Error displaying favorites:', error);
    alert('Ошибка открытия диалогового окна. Пожалуйста, попробуйте еще раз.');
  }
}

const dialogTemplate = `
  <dialog class="dialog" style="border:2px solid gray;border-radius:0.5em;min-width:20em;height:100%;display:flex;flex-direction:column;">
    <div class="favorites" style="flex-grow:1;margin-bottom:1em;"></div>
    <div>
      <button type="button" class="cancel btn btn-default">Отмена</button>
    </div>
  </dialog>
`;
