export const post = function (individual, template, container, mode, extra) {
  const header = template.closest('.section-header');
  if (!header) throw Error('section must contain .section-header element')
  const section = header.closest('section');
  section.classList.add('active-section')
  header.addEventListener('click', function (e) {
    e.preventDefault();
    const ariaExpanded = section.getAttribute('aria-expanded');
    if (ariaExpanded === 'true') {
      hideContent();
    } else {
      showContent();
    }
  });

  const toggleButton = template.querySelector('a.glyphicon');
  const ariaExpanded = section.getAttribute('aria-expanded');
  if (ariaExpanded === 'false') {
    hideContent(false);
  } else {
    showContent(false);
  }

  // const observerConfig = { attributes: true, subtree: true, childList: true };
  // const validationHandler = () => {
  //   const section = template.closest('section');
  //   if (section.querySelector('.has-error')) {
  //     header.classList.add('alert-danger');
  //   } else {
  //     header.classList.remove('alert-danger');
  //   }
  // };
  // const sectionObserver = new MutationObserver(validationHandler);
  // sectionObserver.observe(section, observerConfig);

  // template.addEventListener('edit', () => {
  //   sectionObserver.observe(section, observerConfig);
  // });
  // template.addEventListener('view', () => {
  //   console.log('it is view'); 
  //   sectionObserver.disconnect();
  //   header.classList.remove('alert-danger');
  // });

  // template.addEventListener('remove', () => {
  //   sectionObserver.disconnect();
  // });

  function hideContent(dispatch = true) {
    section.setAttribute('aria-expanded', 'false');
    toggleButton.classList.remove('glyphicon-chevron-down');
    toggleButton.classList.add('glyphicon-chevron-right');
    const content = section.querySelector('.section-content')
    if (content) {
      content.style.display = 'none';
    }
    if (dispatch) {
      const event = new Event("hidden.section");
      section.dispatchEvent(event);
    }
  }

  function showContent(dispatch = true) {
    section.setAttribute('aria-expanded', 'true');
    toggleButton.classList.add('glyphicon-chevron-down');
    toggleButton.classList.remove('glyphicon-chevron-right');
    const content = section.querySelector('.section-content')
    if (content) {
      content.style.display = 'block';
    }
    if (dispatch) {
      const event = new Event("show.section");
      section.dispatchEvent(event);
    }
  }
  
  section.addEventListener('hideRequest', () => {
    hideContent();
  });
  section.addEventListener('showRequest', () => {
    showContent();
  });
};

export const html = `
  <div class="pull-left" style="margin-right: 10px">
    <a href="#" class="glyphicon glyphicon-chevron-down"></a>
  </div>
`;
