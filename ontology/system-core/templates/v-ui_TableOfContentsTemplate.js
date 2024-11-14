import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  if (template.closest('.modal-body') || container.classList.contains('modal-body')) {
    template.classList.add('hidden');
    return;
  }
  const toggle = $('#toggle-menu', template);
  $('body', document).scrollspy({ target: '#offcanvas-menu' });
  $('[data-spy="scroll"]').each(function () {
    var $spy = $(this).scrollspy('refresh');
  });
  const menu = $('#offcanvas-menu', template);
  menu.addClass('open');
  
  toggle.click(function() {
    menu.toggleClass('open');

    if (menu.hasClass('open')) {
      $('.glyphicon', toggle).removeClass('glyphicon-chevron-left').addClass('glyphicon-chevron-right');
    } else {
      $('.glyphicon', toggle).removeClass('glyphicon-chevron-right').addClass('glyphicon-chevron-left');
    }
  });

  // Раскоментить если нужен будет бекдроп
  // $(document).click(function(event) {
  //   if (!$(event.target).closest('#offcanvas-menu, #toggle-menu').length) {
  //     if ($('#offcanvas-menu').hasClass('open')) {
  //       $('#offcanvas-menu').removeClass('open');
  //       $('#toggle-menu .glyphicon').removeClass('glyphicon-chevron-right').addClass('glyphicon-chevron-left');
  //     }
  //   }
  // });
  setTimeout(() => { buildMenu(mode); })
  $(template).on('view', () => { buildMenu('view'); });
  $(template).on('edit', () => { buildMenu('edit'); });
  function buildMenu (mode) {
    const sections = container.parentNode.querySelectorAll('section');
    let sectionMenuHTML = ""
    sections.forEach(section => {
      if (section.classList.contains('hide') || section.classList.contains('hidden') || section.classList.contains('out-of-scope')) return;
      if (section.classList.contains(mode) || !section.classList.contains('-' + mode)) {
        if (section.id) {
          const header = section.querySelector('.section-header');
          if (!header) return;
          const headerSpan = header.querySelector('span');
          const headerText = headerSpan ? headerSpan.innerText : header.innerText;
          sectionMenuHTML += `<li><a href="#${section.id}">${headerText}</a></li>`
        }
      }
    });
    template.querySelector('#menu-list').innerHTML = sectionMenuHTML;
    $('#offcanvas-menu a', template).click(function(e) {
      e.preventDefault();
      var targetId = $(this).attr('href');
      if ($(targetId).is(":visible")) {
        $('html, body').animate({
          scrollTop: $(targetId).offset().top
        }, 500);
      }
    });
  }
};

export const post = function (individual, template, container, mode, extra) {
  
};
  
export const html = `
  <div>
    <style scoped>
      #menu-list>li>a {
        padding: 4px 10px;
        font-size: 0.9em;
      }
      #menu-list>li.active>a {
        border: 1px solid #ddd;
      }
      #offcanvas-menu {
        position: fixed;
        right: -250px;
        top: 78px;
        width: 200px;
        max-height: 100%;
        background-color: #fff;
        border-radius: 8px;
        overflow-y: auto;
        transition: right 0.3s ease;
        box-shadow: 0 0 5px rgba(0,0,0,0.15);
        z-index: 1000;
      }
      #offcanvas-menu.open {
        right: 0;
      }
      .content-section {
        padding-top: 60px;
        padding-bottom: 60px;
      }
      #toggle-menu {
        position: fixed;
        top: 30px;
        right: 10px;
        z-index: 1000; /* Higher than the off-canvas menu */
        border: 1px solid #ddd;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        opacity: 0.5;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #f8f8f8;
        /* Default button-like appearance without specifying primary styling */
      }
      #toggle-menu:hover {
        opacity: 1;
      }
    </style>
    <button id="toggle-menu" class="btn">
      <span class="glyphicon glyphicon-chevron-right" aria-hidden="true"></span>
    </button>

    <div id="offcanvas-menu" class="affix">
      <ul id="menu-list" class="nav nav-tabs nav-stacked" role="tablist">
        
      </ul>
    </div>
  </div>
`;  
