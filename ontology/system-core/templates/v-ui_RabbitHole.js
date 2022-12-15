import $ from 'jquery';
import CommonUtil from '/js/common/util.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const defaultProperties = 'v-s:backwardTarget v-s:parent';
  const allowedProperties = (container.data('properties') || defaultProperties).split(' ');
  const name = mkName(individual);
  let visited;
  for (let i = 0, property; (property = allowedProperties[i]); i++) {
    if (individual.hasValue(property)) {
      const temp = $('h5', template);
      individual[property].forEach(function (prop) {
        const text = "<span title='" + name.title + "'>" + name.label + '</span>';
        visited = [individual.id];
        const wrapper = temp.clone();
        travel(prop, text).then(function (rText) {
          $('small', wrapper).append(rText);
          template.append(wrapper);
        });
      });
      break;
    }
  }

  function travel (individual, text) {
    if (visited.indexOf(individual.id) >= 0) {
      return Promise.resolve(text);
    } else {
      visited.push(individual.id);
    }
    return individual
      .load()
      .then(function () {
        const name = mkName(individual);
        text = "<a href='#/" + individual.id + "' title='" + name.title + "'>" + name.label + '</a>' + ' / ' + text;
        for (let i = 0, property; (property = allowedProperties[i]); i++) {
          if (individual.hasValue(property)) {
            return travel(individual[property][0], text);
            // break;
          }
        }
        return text;
      })
      .catch(function (error) {
        const errorIndividual = new IndividualModel(`v-s:Error_${error.code}`);
        return errorIndividual.load().then(function (errorIndividual) {
          return `<span>${errorIndividual['v-s:errorMessage'].map(CommonUtil.formatValue).join(' ')}</span> / ${text}`;
        });
      });
  }
  function mkName (individual) {
    let label = individual['rdf:type'][0].toString() + ': ' + individual.toString();
    const title = label;
    const re = new RegExp('.*?:');
    if (label.length > 70) {
      label = label.replace(re, function (typeName) {
        return (
          typeName
            .split(' ')
            .reduce(function (abbr, word) {
              return (abbr += word.charAt(0));
            }, '')
            .toUpperCase() + ':'
        );
      });
      label = label.substring(0, 70) + '...';
    }
    return {title: title, label: label};
  }
};

export const html = `
  <div>
    <h5><small></small></h5>
  </div>
`;
