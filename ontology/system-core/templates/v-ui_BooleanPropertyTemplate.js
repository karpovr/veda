export const pre = function (individual, template, container, mode, extra) {
  const targetProperty = container.getAttribute('target-property');
  if (!targetProperty) return;

  function drawBoolean() {
    const value = individual.hasValue(targetProperty, true);
    if (!value) {
      template.classList.add('hidden');
    } else {
      template.classList.remove('hidden');
    }
  }
  drawBoolean();

  individual.on(targetProperty, drawBoolean);
};

export const html = `
    <span class="glyphicon glyphicon-ok hidden"></span>
  `;
