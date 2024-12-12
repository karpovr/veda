import $ from 'jquery';
import Crypto from '/js/browser/crypto.js';
import IndividualModel from '/js/common/individual_model.js';

export const pre = async function (individual, template, container, mode, extra) {
  const crypto = Crypto.getInstance();
  try {
    await crypto.init();
    $('button#sign-attachments', template).removeClass('hidden');
  } catch (error) {
    console.log(error);
    $('button#sign-attachments', template).remove();
    return;
  }

  $('#sign-attachments', template).click(async () => {
    try {
      const filesToCryptoProcess = [individual];
      await filesToCryptoProcess.reduce(async (acc, cur) => {
        await acc;
        if (!cur.hasValue('v-s:uid')) {
          cur['v-s:uid'] = [crypto.genUUID()];
          console.log(cur['v-s:uid']);
          await cur.save();
        }
      }, Promise.resolve());
      await crypto.addBatchSignature(filesToCryptoProcess);
    } catch (err) {
      console.log(err);
    }
    await checkSignatures();
  });

  let isAllSignedByUser = true;
  async function checkSignatures() {
    try {
      isAllSignedByUser = true;
      const signCreators = await individual.getChainValue('v-s:digitalSignature', 'v-s:creator');
      const userCreated =  signCreators.filter(creator => {
        return creator.id == veda.appointment;
      });
      if (userCreated.length == 0) {
        isAllSignedByUser = false;
      }
    } catch (err) {
      console.log(err);
      isAllSignedByUser = false;
    }
    if (isAllSignedByUser == false) {
      $('#sign-attachments', template).removeAttr('disabled');
    } else {
      $('#sign-attachments', template).attr('disabled', 'disabled');
    }
  }
  await checkSignatures();
};

export const html = `
<div class="row-container">
  <div class="sign-action">
    <button style="font-size: 1.5rem;" class="btn btn-primary btn-xs hidden" id="sign-attachments" title="Подписать">
      <i class="bi bi-pen"></i>
    </button>
  </div>
  <div class="file">
    <div>
      <a about="@" class="download-link" href="/files/@">
        <span property="v-s:fileName"></span>
      </a>
      <small about="@" property="v-s:created"></small>
    </div>
    <small about="@" rel="v-s:creator" data-template="v-ui:LabelTemplate"></small>
  </div>
  <div class="signatures" about="@" class="digital-signature" rel="v-s:digitalSignature">
    <div class="signature-row">
      <div class="signature">
        <div>
          <a class="download-link" href="/files/@">
            <span property="v-s:fileName"></span>
          </a>        
          <small property="v-s:created"></small>
        </div>
        <small rel="v-s:creator" data-template="v-ui:LabelTemplate"></small>
      </div>
      <div class="sign-description">
        <div rel="v-s:hasMchdInfo" data-template="v-ui:MchdLinkTemplate"></div>
      </div>
    </div>
  </div>
  <div class="comment">
    <span class="view -edit search" property="rdfs:comment"></span>
    <veda-control data-type="string" property="rdfs:comment" class="-view edit search" style="width: 100%;"></veda-control>
  </div>
</div>
  `;