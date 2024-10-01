import $ from 'jquery';
import veda from '/js/common/veda.js';
import Backend from '/js/browser/backend_browser.js';
import IndividualModel from '/js/common/individual_model.js';


export const pre = async function (individual, template, container, mode, extra) {
  const elements = template.querySelectorAll('.icon');
  elements.forEach(element => {
    element.addEventListener('click', (e) => {
      elements.forEach(el => el.classList.remove('selected'));
      element.classList.add('selected');
      const reactionContainer = element.querySelector('.reaction-container');
      const reaction = reactionContainer.getAttribute('about');
      individual['v-s:hasReaction'] = [reaction];
      console.log(individual.properties);
    });
  });
}

export const post = async function (individual, template, container, mode, extra) {
  
}

export const html = `
<div class="sheet container">
  <style scoped>
    .feedback-row {
      display: flex;
      flex-direction: row;
      text-align: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .feedback-col {
      cursor: pointer;
      padding: 15px;
    }
    .selected {
      background-color: #d3d3d3;
      border: 2px solid #a8a8a8;
      border-radius: 8px;
    }
    .icon {
      padding: 20px;
    }
    .actions {
      margin-top: 25px;
      padding: 0px 30px;
    }
    .bi-emoji-laughing-fill {
      color: #6CBF44;
    }
    .bi-emoji-smile-fill {
      color: #7EDD7F;
    }
    .bi-emoji-neutral-fill {
      color: #F0B027;
    }
    .bi-emoji-frown-fill {
      color: #EF4B3D;
    }
    .bi-emoji-angry-fill {
      color: #CC2232;
    }
    .icon-bg {
      font-size: 70px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 0.9em;
      height: 0.9em; 
      background-color: black;
      border-radius: 50%;
  }
  </style>
  <h2 about="v-s:Feedback" property="rdfs:label" class="text-center" style="color:#555"></h2>
  <!-- Feedback rate icons -->
  <div class="-view edit search">
    <div class="feedback-row -view edit search">
      <div class="feedback-col">
        <div class="icon" id="icon-very-good">
          <i class="bi bi-emoji-laughing-fill icon-bg"></i>
          <div class="reaction-container" about="v-s:ReactionVeryGood" data-template="v-ui:ReactionTemplate"></div>
        </div>
      </div>
      <div class="feedback-col">
        <div class="icon" id="icon-good">
          <i class="bi bi-emoji-smile-fill icon-bg"></i>
          <div class="reaction-container" about="v-s:ReactionGood" data-template="v-ui:ReactionTemplate"></div>
        </div>
      </div>
      <div class="feedback-col">
        <div class="icon" id="icon-normal">
          <i class="bi bi-emoji-neutral-fill icon-bg"></i>
          <div class="reaction-container" about="v-s:ReactionNormal" data-template="v-ui:ReactionTemplate"></div>
        </div>
      </div>
      <div class="feedback-col">
        <div class="icon" id="icon-bad">
          <i class="bi bi-emoji-frown-fill icon-bg"></i>
          <div class="reaction-container" about="v-s:ReactionBad" data-template="v-ui:ReactionTemplate"></div>
        </div>
      </div>
      <div class="feedback-col">
        <div class="icon" id="icon-very-bad">
          <i class="bi bi-emoji-angry-fill icon-bg"></i>
          <div class="reaction-container" about="v-s:ReactionVeryBad" data-template="v-ui:ReactionTemplate"></div>
        </div>
      </div>
    </div>
    <!-- Comment input -->
    <div style="padding: 0px 30px;">
      <em class="view -edit search" about="rdfs:comment" property="rdfs:label"></em>
      <div property="rdfs:comment" class="view -edit search"></div>
      <veda-control data-type="text" rows="10" rel="rdfs:comment" class="comment-control -view edit search"></veda-control>
    </div>
  </div>
  <div class="view -edit -search">
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5">
        <label about="v-s:hasLinkObject" property="rdfs:label"></label>
      </div>
      <div class="col-sm-3 col-xs-3">
        <div rel="v-s:hasLinkObject" data-template="v-ui:LabelTemplate"></div>
      </div>
    </div>
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5">
        <label about="v-s:Reaction" property="rdfs:label"></label>
      </div>
      <div class="col-sm-3 col-xs-3">
        <div rel="v-s:hasReaction"></div>
      </div>
    </div>
    <div class="row row-attribute">
      <div class="col-sm-3 col-xs-5">
        <label about="rdfs:comment" property="rdfs:label"></label>
      </div>
      <div class="col-sm-3 col-xs-3">
        <div property="rdfs:comment"></div>
      </div>
    </div>
  </div>
  <div class="view -edit -search" about="@" data-template="v-ui:SystemPropertiesNewTemplate" data-embedded="true"></div>
  <div class="actions view edit -search">
    <span about="@" data-template="v-ui:StandardButtonsTemplate" data-embedded="true" data-buttons="save delete"></span>
  </div>
</div>
`