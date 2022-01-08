import $ from 'jquery';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  var defaultProperties = 'v-s:backwardTarget v-s:parent';
  var allowedProperties = (container.data('properties') || defaultProperties).split(' ');
  var name = mkName(individual);
  var visited;
  for (var i = 0, property; (property = allowedProperties[i]); i++) {
    if (individual.hasValue(property)) {
      var temp = $('h5', template);
      individual[property].forEach(function (prop) {
        var text = "<span title='" + name.title + "'>" + name.label + '</span>';
        visited = [individual.id];
        var wrapper = temp.clone();
        travel(prop, text).then(function (rText) {
          $('small', wrapper).append(rText);
          template.append(wrapper);
        });
      });
      break;
    }
  }

  function travel(individual, text) {
    if (visited.indexOf(individual.id) >= 0) {
      return Promise.resolve();
    } else {
      visited.push(individual.id);
    }
    return individual
      .load()
      .then(function () {
        var name = mkName(individual);
        text = "<a href='#/" + individual.id + "' title='" + name.title + "'>" + name.label + '</a>' + ' / ' + text;
        for (var i = 0, property; (property = allowedProperties[i]); i++) {
          if (individual.hasValue(property)) {
            return travel(individual[property][0], text);
            //break;
          }
        }
        return text;
      })
      .catch(function (error) {
        const errorIndividual = new IndividualModel(`v-s:Error_${error.code}`);
        return errorIndividual.load().then(function (errorIndividual) {
          return `<span>${errorIndividual['v-s:errorMessage'].map(Util.formatValue).join(' ')}</span> / ${text}`;
        });
      });
  }
  function mkName(individual) {
    var label = individual['rdf:type'][0].toString() + ': ' + individual.toString();
    var title = label;
    var re = new RegExp('.*?:');
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
    return { title: title, label: label };
  }
};

export const html = `
  <div>
    <h5><small></small></h5>
  </div>
`;
