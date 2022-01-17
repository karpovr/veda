import BrowserUtil from '/js/browser/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import Backend from '/js/common/backend.js';
import IndividualModel from '/js/common/individual_model.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  function presentTypeLink (link, typeLinksContainer) {
    return link.load().then(function (link) {
      if (link.hasValue('rdf:type', 'v-s:Link')) {
        if (link.hasValue('v-s:from', individual) && link.hasValue('v-s:to')) {
          link = link['v-s:to'][0];
        } else if (link.hasValue('v-s:to', individual) && link.hasValue('v-s:from')) {
          link = link['v-s:from'][0];
        }
      }
      if (!template.closest(".link-node[resource='" + BrowserUtil.escape4$(link.id) + "']").length) {
        return link.present(typeLinksContainer, 'v-s:LinksTreeRecursiveTemplate');
      }
    });
  }

  function getOutTypeLinks (allowedTypeUri, outPropertiesUris) {
    let links = [];
    outPropertiesUris.forEach(function (outPropertyUri) {
      links = links.concat(individual[outPropertyUri]);
    });
    const linksPromises = links.map(function (link) {
      return link.load();
    });
    return Promise.all(linksPromises).then(function (loadedLinks) {
      return loadedLinks.filter(function (link) {
        const linkTypeUri = link['rdf:type'][0].id;
        return linkTypeUri === allowedTypeUri;
      });
    });
  }

  function getInTypeLinks (allowedTypeUri, inPropertiesUris) {
    const allowedTypeUriQuery = "'rdf:type'==='" + allowedTypeUri + "'";
    const inPropertiesUrisQuery = inPropertiesUris
      .map(function (inPropertyUri) {
        return "'" + inPropertyUri + "'==='" + individual.id + "'";
      })
      .join('||');
    const q = allowedTypeUriQuery + ' && (' + inPropertiesUrisQuery + ')';
    return !inPropertiesUrisQuery || allowedTypeUri === 'v-s:Link' ?
      Promise.resolve([]) :
      Backend.query({
        ticket: veda.ticket,
        query: q,
        limit: 500,
        async: true,
      }).then(function (queryResult) {
        const links = queryResult.result.map(function (uri) {
          return new IndividualModel(uri);
        });
        return links;
      });
  }

  const type = individual['rdf:type'][0];
  let linksTree;
  if (!type.hasValue('v-s:hasLinksTree')) {
    linksTree = new IndividualModel();
    linksTree['rdf:type'] = [new IndividualModel('v-s:LinksTree')];
    linksTree['v-s:outProperty'] = [new IndividualModel('v-s:hasLink')];
    linksTree['v-s:allowedType'] = [new IndividualModel('v-s:Link')];
  } else {
    linksTree = type['v-s:hasLinksTree'][0];
  }

  return linksTree.load().then(function (linksTree) {
    const inPropertiesUris = linksTree['v-s:inProperty'].map(function (property) {
      return property.id;
    });
    const outPropertiesUris = linksTree['v-s:outProperty'].map(function (property) {
      return property.id;
    });
    if (outPropertiesUris.indexOf('v-s:hasLink') < 0) {
      outPropertiesUris.push('v-s:hasLink');
    }
    const allowedTypesUris = linksTree['v-s:allowedType'].map(function (allowedType) {
      return allowedType.id;
    });
    if (allowedTypesUris.indexOf('v-s:Link') < 0) {
      allowedTypesUris.push('v-s:Link');
    }

    const allowedTypesContainer = $('.allowed-types', template);
    const allowedTypesTemplate = allowedTypesContainer.html();
    allowedTypesContainer.empty();
    const allowedTypesPromises = allowedTypesUris.map(function (allowedTypeUri) {
      const allowedType = new IndividualModel(allowedTypeUri);
      return allowedType.present(allowedTypesContainer, allowedTypesTemplate);
    });

    return Promise.all(allowedTypesPromises).then(function () {
      $('.glyphicon.expand', template).click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        const $this = $(this);

        if ($this.hasClass('glyphicon-chevron-right')) {
          $this.addClass('glyphicon-chevron-down').removeClass('glyphicon-chevron-right');
          allowedTypesContainer.removeClass('hidden');
        } else if ($this.hasClass('glyphicon-chevron-down')) {
          $this.addClass('glyphicon-chevron-right').removeClass('glyphicon-chevron-down');
          allowedTypesContainer.addClass('hidden');
        }
      });

      $('.glyphicon.expand-type', template).click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        const $this = $(this);
        const typeLinksContainer = $this.siblings('.type-links');
        if ($this.hasClass('glyphicon-chevron-right')) {
          $this.addClass('glyphicon-chevron-down').removeClass('glyphicon-chevron-right');
          typeLinksContainer.removeClass('hidden');
          $this.addClass('fa fa-spinner fa-pulse fa-lg fa-fw');
          if (!typeLinksContainer.children().length) {
            const allowedTypeUri = $this.parent().attr('resource');
            getOutTypeLinks(allowedTypeUri, outPropertiesUris)
              .then(function (outLinks) {
                return Promise.all(
                  outLinks.map(function (link) {
                    return presentTypeLink(link, typeLinksContainer);
                  }),
                );
              })
              .then(function () {
                return getInTypeLinks(allowedTypeUri, inPropertiesUris);
              })
              .then(function (inLinks) {
                const inLinksPromises = inLinks.map(function (link) {
                  return presentTypeLink(link, typeLinksContainer);
                });
                return Promise.all(inLinksPromises);
              })
              .then(function () {
                $this.removeClass('fa fa-spinner fa-pulse fa-lg fa-fw');
                if (!typeLinksContainer.children().length) {
                  $this.parent().hide(350, function () {
                    $(this).remove();
                  });
                }
              })
              .catch(function (error) {
                console.log(error);
              });
          } else {
            $this.toggleClass('fa fa-spinner fa-pulse fa-lg fa-fw');
          }
        } else if ($this.hasClass('glyphicon-chevron-down')) {
          $this.addClass('glyphicon-chevron-right').removeClass('glyphicon-chevron-down');
          typeLinksContainer.addClass('hidden');
        }
      });
    });
  });
};

export const html = `
  <ul class="link-node">
    <li>
      <a href="#" class="glyphicon glyphicon-chevron-right expand"></a> <span about="@" data-template="v-s:TrimmedLinkTemplate"></span>
      <ul class="allowed-types hidden">
        <li>
          <a href="#" class="glyphicon glyphicon-chevron-right expand-type"></a> <span class="fa fa-folder-open-o"></span>
          <strong about="@" property="rdfs:label"></strong>
          <div class="type-links hidden"></div>
        </li>
      </ul>
    </li>
  </ul>
`;
