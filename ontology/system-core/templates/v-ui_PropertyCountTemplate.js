export const pre = function (individual, template, container, mode, extra) {
  const targetProperty = container.getAttribute('target-property');
  if (!targetProperty) return;

  function setCount () {
    const count = individual[targetProperty] ? individual[targetProperty].length : 0;
    console.log(count);
    template.innerText = count;
  }
  setCount();
  individual.on(targetProperty, setCount);

  $(template).one('remove', function () {
    individual.off(targetProperty, setCount);
  });
};

export const html = `
  <span class="badge"></span>  
`;
