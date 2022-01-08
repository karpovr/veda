import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var vedaInfo = new IndividualModel('v-s:vedaInfo');
  vedaInfo.load().then(function (vedaInfo) {
    document.title = vedaInfo.toString();
  });

  // Render user
  var userInfo = $('#user-info', template);
  var userInfoTmpl = 'v-ui:IconPersonTemplate';
  userInfo.empty();
  veda.user.present(userInfo, userInfoTmpl);
};

export const html = `
  <div class="page">
    <nav role="navigation" class="navbar navbar-veda">
      <div class="container">
        <div class="navbar-header">
          <button type="button" class="btn btn-info navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar-collapse" aria-expanded="false">
            <span class="glyphicon glyphicon-menu-hamburger"></span>
          </button>
          <a class="navbar-brand" href="#/"><img src="/img/veda-logo.png" /></a>
        </div>
        <div class="collapse navbar-collapse" id="navbar-collapse">
          <ul class="nav navbar-nav navbar-right" style="margin-right:-30px;" about="v-s:MainMenu" data-template="v-s:MenuTemplate"></ul>
          <ul class="nav navbar-nav navbar-right">
            <li about="v-s:Favorites" data-template="v-s:FavoritesIndicatorTemplate" style="border-right:1px solid #ddd;"></li>
            <li about="v-s:Contacts" data-template="v-s:LayoutTemplate_contacts"></li>
            <li about="v-fs:MultiFunctionalSearch" data-template="v-s:LayoutTemplate_search"></li>
            <li about="v-cal:TasksCalendar" data-template="v-cal:FunctionCalendarIndicatorTemplate"></li>
            <li about="v-ft:Inbox" data-template="v-ft:FunctionTasksIndicatorTemplate"></li>
            <li id="user-info"></li>
            <li about="v-s:Logout" data-template="v-ui:ExitButtonTemplate"></li>
            <li about="v-ui:AvailableLanguage" data-template="v-ui:LanguageSwitchTemplate"></li>
            <li about="@" data-template="v-ui:FullWidthSwitchTemplate"></li>
          </ul>
        </div>
      </div>
    </nav>

    <div id="main"></div>

    <nav class="navbar-fixed-bottom hidden-print container">
      <div id="copyright" class="text-right text-muted">
        <span about="v-s:PoweredBy" property="rdfs:label"></span>
        <a about="v-s:VedaPlatform" property="rdfs:label" href="https://github.com/semantic-machines/veda"></a>. &copy;
        <a href="https://semantic-machines.com" about="v-s:SemanticMachines" property="rdfs:label"></a>.
        <span about="v-s:License" property="rdfs:label"></span>
        <a alt="GNU General Public License version 3 official text" href="http://www.gnu.org/licenses/gpl.html">GPLv3.</a>
      </div>
    </nav>
  </div>
`;
