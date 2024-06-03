import BrowserUtil from '/js/browser/util.js';
import CommonUtil from '/js/common/util.js';
import $ from 'jquery';
import veda from '/js/common/veda.js';
import IndividualModel from '/js/common/individual_model.js';
import Backend from '/js/common/backend.js';

export const pre = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  return new IndividualModel('v-s:vedaInfo')
    .load()
    .then(function (vedaInfo) {
      if (vedaInfo.hasValue('v-s:tenant') && vedaInfo['v-s:tenant'][0].id != veda.appointment['v-s:parentOrganization'][0].id) {
        individual['v-s:managedOrganization'] = vedaInfo['v-s:tenant'];
        $('#tenant', template).click(function () {
          individual['v-s:managedOrganization'] = vedaInfo['v-s:tenant'];
        });
      } else {
        $('#tenant', template).remove();
      }
      return true;
    })
    .then(function () {
      if (veda.user && veda.user.hasValue('v-s:parentOrganization')) {
        const selfOrg = veda.user['v-s:parentOrganization'][0];
        if (!individual.hasValue('v-s:managedOrganization')) {
          individual['v-s:managedOrganization'] = [selfOrg];
        }
        return selfOrg.present($('#selfOrg span', template), 'v-ui:LabelTemplate');
      } else {
        $('#selfOrg', template).remove();
      }
    }).then(function () {
      if (extra != undefined && extra.target != undefined) {
        const promise = extra.target[0] instanceof IndividualModel ? Promise.resolve(extra.target[0]) : new veda.IndividualModel(extra.target[0]).load();
        return promise
          .then(function(appointment) {
            const splited = appointment['rdfs:label'][0].split(' ');
            const searchText = splited.length > 1 ? [splited[0], splited[1]].join(' ') : splited[0];
            $('#searchText input', template).val(searchText);
            individual.targetToCards = appointment['v-s:parentUnit'][0].id;
            individual['v-s:managedOrganization'] = appointment['v-s:parentOrganization'];
          }).catch(function(exp) {
            console.log(exp);
          });
      }
    });
};

export const post = function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const orgTree = $('#orgTree', template);
  const orgContent = $('#orgContent', template);

  let basePos;
  let baseWidth;
  let maxWidth;
  $('#resizeLine', template).on('mousedown', function (e) {
    e.preventDefault();
    basePos = e.clientX;
    baseWidth = orgTree.width();
    maxWidth = orgTree.parent().width();
  });

  template.on('mouseup', function (e) {
    e.preventDefault();
    basePos = undefined;
  });

  template.on('mousemove', function (e) {
    if (basePos == undefined) return;
    e.preventDefault();
    const changedWidth = baseWidth + (e.clientX - basePos);
    if (changedWidth < 200) {
      orgTree.css('width', 200);
      orgContent.css('width', maxWidth - 200);
    } else if (changedWidth > 600) {
      orgTree.css('width', 600);
      orgContent.css('width', maxWidth - 600);
    } else {
      orgTree.css('width', changedWidth);
      orgContent.css('width', maxWidth - changedWidth);
    }
  });

  const loadIndicator = $('#load-indicator');
  const findDeleted = false;
  let searchOrgMode = individual.hasValue('v-s:managedOrganization') ? 'targetOrg' : 'allOrg';
  let isContactManager = false;
  let userDisplayedElements;
  if (veda.user.preferences.hasValue('v-ui:displayedElements')) {
    userDisplayedElements = veda.user.preferences['v-ui:displayedElements'][0];
  } else {
    userDisplayedElements = 10;
  }

  veda.user.isMemberOf('cfg:ContactManagerGroup').then(function (isMember) {
    isContactManager = isMember || veda.appointment.id == 'cfg:AdministratorAppointment';
  });

  $('#selfOrg', template).click(function () {
    individual['v-s:managedOrganization'] = veda.user['v-s:parentOrganization'];
  });

  $('section .section-header', template).click(function () {
    const self = $(this);
    $('span.glyphicon', self).toggleClass('glyphicon-chevron-right glyphicon-chevron-down');
    self.siblings().toggle();
  });

  template.on('click', '.img-thumbnail', function (e) {
    e.preventDefault();
    const uri = $(this).attr('resource');
    const modal = BrowserUtil.showSmallModal(new IndividualModel(uri), 'v-ui:ImageTemplate');
    modal.find('.modal-dialog').removeClass('modal-lg').addClass('modal-sm');
  });

  const parentContainerTmpl =
    '<div class="row">' +
    '<div class="col-md-5">' +
    '<div class="margin-sm-h"><strong about="@" property="rdfs:label"></strong></div>' +
    '<div class="margin-sm-h"><small>' +
    '<span about="v-fs:cursor" property="rdfs:label"></span>' +
    '<span class="margin-sm-h badge"></span>&nbsp;&nbsp;' +
    '<span about="v-fs:estimated" property="rdfs:label"></span>' +
    '<span class="margin-sm-h badge"></span>' +
    '</small></div>' +
    '</div>' +
    '<div class="col-md-6" about="@" rel="v-s:hasCommunicationMean">' +
    '<div>' +
    '<strong class="margin-sm-h" about="@" rel="v-s:hasCommunicationMeanChannel" data-template="v-ui:LabelTemplate"></strong>' +
    '<span about="@" property="v-s:description"></span>  ' +
    '</div>' +
    '</div>' +
    '<div class="col-md-1">' +
    '<span class="hidden faviconIcon pointer fa fa-lg fa-star-o"></span>' +
    '<span style="float:right" about="@" class="zoom hidden" data-template="v-ui:IconModalTemplate"></span>' +
    '</div>' +
    '</div>';

  function drawCards (parent, from, limit) {
    loadIndicator.show();
    let isNeedBtnMore = false;
    if (limit == undefined) limit = userDisplayedElements;
    if (from == undefined) {
      $('tbody', orgContent).empty();
      orgContent.show();
      from = 0;
    }
    $('#parentContainer', orgContent).empty();

    // parent already has list of all children
    return parent
      .present($('#parentContainer', orgContent), parentContainerTmpl)
      .then(function (tmpl) {
        if (parent.hasValue('v-s:hasCommunicationMean')) {
          const faviconIcon = $('span.faviconIcon', tmpl);
          faviconIcon.removeClass('hidden');
          if (veda.user.aspect.hasValue('v-s:hasFavoriteContact', parent)) {
            faviconIcon.toggleClass('fa-star-o fa-star');
          }
          faviconIcon.click(function () {
            if (faviconIcon.hasClass('fa-star-o')) {
              veda.user.aspect.addValue('v-s:hasFavoriteContact', parent);
            } else if (faviconIcon.hasClass('fa-star')) {
              veda.user.aspect.removeValue('v-s:hasFavoriteContact', parent);
            }
            veda.user.aspect.save();
            faviconIcon.toggleClass('fa-star-o fa-star');
          });
        }
        if (isContactManager) $('.zoom.hidden', tmpl).removeClass('hidden');
        return getChildren(parent);
      })
      .then(function (childrenUris) {
        const endIndex = childrenUris.length > from + limit ? from + limit : childrenUris.length;
        const promises = [];
        for (let i = from; i < endIndex; i++) {
          const uri = childrenUris[i];
          promises.push(new IndividualModel(uri).present($('<div></div>'), 'v-s:ContactCardTemplate'));
        }
        if (endIndex != childrenUris.length) {
          isNeedBtnMore = true;
        }
        if (isNeedBtnMore) {
          $('.result-info-container', orgContent).show();
          $('.result-info-container #showMoreCards', orgContent).off('click');
          $('.result-info-container #showMoreCards', orgContent).click(function () {
            drawCards(parent, from + limit);
          });
          $('.result-info-container #showAllCards', orgContent).off('click');
          $('.result-info-container #showAllCards', orgContent).click(function () {
            drawCards(parent, from + limit, childrenUris.length);
          });
        } else {
          $('.result-info-container', orgContent).hide();
        }
        $('span.badge:nth-child(4)', orgContent).text(childrenUris.length);
        $('span.badge:nth-child(2)', orgContent).text(endIndex);
        if (promises.length == 0) {
          const emptyIndivid = new IndividualModel('v-fs:Empty');
          promises.push(emptyIndivid.present($('<div></div>'), 'v-s:ContactCardTemplate'));
        }
        return Promise.all(promises);
      })
      .then(function (templates) {
        for (let i = 0; i < templates.length; i++) {
          $('.hideInStructure', templates[i]).siblings().removeClass('col-md-8');
          $('.hideInStructure', templates[i]).remove();
          $('tbody', orgContent).append(templates[i]);
          if (isContactManager) $('.zoom.hidden', templates[i]).removeClass('hidden');
        }
        $('#resizeLine', template).height(Math.max(orgContent.height(), orgTree.height()));
        loadIndicator.hide();
        return orgContent;
      });
  }

  function initialStructure (org) {
    orgTree.empty();
    orgContent.hide();
    if (org == undefined) {
      org = individual.hasValue('v-s:managedOrganization') ? individual['v-s:managedOrganization'][0] : null;
    }
    if (org) {
      $('section#OrgStructure').show();
      return getRowTemplate(org)
        .then(function (tmpl) {
          return org.present(orgTree, tmpl);
        })
        .then(function (rendered) {
          const row = $('#orgTree div.value-row', template);
          return openRow(row).then(function () {
            // drawCards(org);

            return rendered;
          });
        });
    } else {
      $('section#OrgStructure').hide();
      return Promise.resolve(false);
    }
  }

  function getRowTemplate (value) {
    return value.load().then(function (value) {
      const rowTmpl =
        "<div class='value-row'>" +
        "<div class='item'>" +
        "<a href='#' class='expand glyphicon glyphicon-chevron-right'></a>" +
        "<span style='margin:0 5px;' class='fa fa-lg {icon}'></span>" +
        "<span about='@' data-template='v-ui:LabelTemplate'></span>" +
        '</div>' +
        '</div>';
      let icon = '';
      if (value.hasValue('rdf:type', 'v-s:Appointment') || value.hasValue('rdf:type', 'v-s:Position')) {
        return null;
      }
      if (value.hasValue('rdf:type', 'v-s:Organization')) {
        icon = 'fa-sitemap';
      }
      if (value.hasValue('rdf:type', 'v-s:Department') || value.hasValue('rdf:type', 'v-s:OrgGroup')) {
        icon = 'fa-folder-o';
      }
      return rowTmpl.replace('{icon}', icon);
      // else {
      //   return getChildren(value, false).then(function (children) {
      //     if ( value.treeChildrens > 0 ) {
      //       expand = "<a href='#' class='expand glyphicon glyphicon-chevron-right'></a>";
      //     }
      //   });
      // }
      // return rowTmpl.replace("{icon}", icon).replace("{expand}", expand);
    });
  }

  function getChildren (parent, refresh, mode) {
    if (parent.allChildren && !refresh) {
      return Promise.resolve(parent.allChildren);
    }
    let childrenUris = [];
    if (parent.hasValue('rdf:type', 'v-s:Appointment')) {
      return Promise.resolve([]);
    }
    loadIndicator.show();
    const parentUri = parent.id;

    const selectPart = 'SELECT DISTINCT id ';
    const wherePart = "WHERE v_s_parentUnit_str=['" + parentUri + "'] AND v_s_deleted_int=[0]";
    const endingPart = " group by id, rdfs_label_str having sum(sign) > 0 order by arraySort(x -> endsWith(lowerUTF8(x), '@en'), rdfs_label_str) asc";
    const queryDepartments = selectPart + 'FROM veda_tt.`v-s:Department` FINAL ' + wherePart + endingPart;
    let queryAppointment =
      selectPart +
      'FROM veda_tt.`v-s:Appointment` FINAL ' +
      "WHERE v_s_parentUnit_str=['" +
      parentUri +
      "'] AND v_s_deleted_int=[0] AND v_s_official_int=[1] AND NOT(lowerUTF8(arrayStringConcat(v_s_origin_str, '')) LIKE '%group%')" +
      endingPart;
    let queryPositions =
      selectPart +
      'FROM veda_tt.`v-s:Position` FINAL ' +
      "WHERE v_s_parentUnit_str=['" +
      parentUri +
      "'] AND v_s_deleted_int=[0] AND lowerUTF8(arrayStringConcat(v_s_origin_str, ' ')) LIKE '%group%'" +
      endingPart;
    if (mode == 'notAppointment') {
      queryAppointment = null;
      queryPositions = null;
    }

    let queryStringArray = [];
    if (parent.hasValue('rdf:type', 'v-s:Department') || parent.hasValue('rdf:type', 'v-s:Subsidiary')) {
      queryStringArray = [queryDepartments, queryPositions, queryAppointment];
    } else if (parent.hasValue('rdf:type', 'v-s:OrgGroup')) {
      const queryOrgGroup = selectPart + 'FROM veda_tt.`v-s:OrgGroup` ' + wherePart + endingPart;
      queryStringArray = [queryOrgGroup, queryPositions, queryAppointment];
    } else if (parent.hasValue('rdf:type', 'v-s:Organization')) {
      const queryOrgGroup = selectPart + 'FROM veda_tt.`v-s:OrgGroup` ' + wherePart + endingPart;
      const querySubsidiary = selectPart + "FROM veda_tt.`v-s:Subsidiary` WHERE v_s_parent_str=['" + parentUri + "'] AND v_s_deleted_int=[0]" + endingPart;
      queryStringArray = [querySubsidiary, queryDepartments, queryOrgGroup, queryPositions, queryAppointment];
    }

    const sort = "'rdfs:label_ru' asc";
    const queries = queryStringArray.map(function (queryString) {
      if (queryString == null) return Promise.resolve({result: []});
      return Backend.query({
        ticket: veda.ticket,
        sql: queryString,
        sort: sort,
        from: 0,
        limit: 10000,
        top: 300,
      });
    });
    return Promise.all(queries).then(function (queryResults) {
      parent.treeChildrens = 0;
      queryResults.forEach(function (queryResult, i) {
        // 2 last items not counting in childrens (appointments, positions)
        if (i + 2 < queryResults.length) parent.treeChildrens += queryResult.count;
        childrenUris = childrenUris.concat(queryResult.result);
      });
      childrenUris = CommonUtil.unique(childrenUris);
      parent.allChildren = childrenUris;
      loadIndicator.hide();
      return childrenUris;
    });
  }

  function drawChildren (parentUri, rootElement) {
    const childrenContainer = rootElement.children('.children');
    if (childrenContainer.length) {
      childrenContainer.removeClass('hidden');
      return Promise.resolve(childrenContainer.length);
    } else {
      rootElement.append("<div class='children'></div>");
      loadIndicator.show();
      return getChildren(new IndividualModel(parentUri), true)
        .then(function (childrenUris) {
          return childrenUris.reduce(async (acc, cur) => {
            acc = await acc;
            const child = new IndividualModel(cur);
            const tmpl = await getRowTemplate(child);
            if (tmpl == null) return acc;
            await child.present(rootElement.children('.children'), tmpl);
            return ++acc;
          }, Promise.resolve(0));
          // const promises = childrenUris.map(function (childUri) {
          //   const child = new IndividualModel(childUri);
          //   return getRowTemplate(child).then(function (tmpl) {
          //     if (tmpl == null) {
          //       return [child, Promise.resolve(null)];
          //     } else {
          //       return [child, tmpl];
          //     }
          //     return child.present(rootElement.children('.children'), tmpl);
          //   });
          // });
          // return Promise.all(promises);
        })
        .then(function (result) {
          loadIndicator.hide();
          // result = result.filter(function (item) {
          //   return item != null;
          // });
          // return result.length;
          return result;
        });
    }
  }

  function openFromStructure (targetUri) {
    const isInRoot = false;
    const targetIndivid = new IndividualModel(targetUri);
    if ($('section#OrgStructure .section-header .glyphicon', template).hasClass('glyphicon-chevron-right')) {
      $('section#OrgStructure .section-header').click();
    }
    return getParentUnitChain(targetIndivid)
      .then(function (chain) {
        let rootOrg;
        if (chain.length == 0) {
          // isInRoot = true;
          rootOrg = targetIndivid;
        } else {
          rootOrg = chain.pop();
          chain.unshift(targetIndivid);
        }
        return initialStructure(rootOrg).then(function (tmpl) {
          return chain.reduceRight(function (pr, cur) {
            return pr.then(function () {
              const row = $("div.value-row[resource='" + cur.id + "']", tmpl);
              return openRow(row);
            });
          }, Promise.resolve());
        });
      })
      .then(function () {
        const targetRow = $("div.value-row[resource='" + targetUri + "'] > .item", template);
        targetRow.addClass('warning');
        return isInRoot ? true : drawCards(new IndividualModel(targetUri));
      })
      .then(function () {
        const position = orgContent.offset().top;
        if (position > 0) {
          $('html, body').animate({
            scrollTop: position,
          });
        }
        individual.targetToCards = targetUri;
      });
  }

  function getParentUnitChain (target, acc) {
    if (acc == undefined) acc = [];
    return target.load().then(function () {
      if (target.hasValue('v-s:parentUnit')) {
        const parentUnit = target['v-s:parentUnit'][0];
        acc.push(parentUnit);
        return getParentUnitChain(parentUnit, acc);
      } else {
        return acc;
      }
    });
  }

  new IndividualModel('v-s:SearchTextBundle').load().then(function (bundle) {
    $('#searchText input', template).attr('placeholder', bundle['rdfs:label'].map(CommonUtil.formatValue).join(' '));
  });

  let searchHelperObj = {};
  function setSearchHelperObjToDefault () {
    searchHelperObj = {
      org: {
        handlered: 0,
      },
      dep: {
        handlered: 0,
      },
      app: {
        handlered: 0,
      },
      phone: {
        handlered: 0,
      },
      email: {
        handlered: 0,
      },
      pos: {
        handlered: 0,
      },
    };
  }

  $('#searchButton', template).click(function () {
    let searchText = $('#searchText input', template).val();
    if (!searchText) return;
    searchText = searchText.trim();

    setSearchHelperObjToDefault();
    loadIndicator.show();

    const resultOrg = $('#resultOrg', template).hide();
    $('tbody', resultOrg).empty();
    const resultDep = $('#resultDep', template).hide();
    $('tbody', resultDep).empty();
    const resultApp = $('#resultApp', template).hide();
    $('tbody', resultApp).empty();
    const resultPos = $('#resultPos', template).hide();
    $('tbody', resultPos).empty();

    const searchPromise = [];
    const queryStringArr = genQueryStringArray(searchText, findDeleted, searchOrgMode == 'targetOrg');
    searchPromise.push(queryStringArr[0] == null ? Promise.resolve([]) : searchAndLoad('org', queryStringArr[0], 0));
    searchPromise.push(searchAndLoad('dep', queryStringArr[1], 0));
    searchPromise.push(searchAndLoad('app', queryStringArr[2], 0));
    searchPromise.push(searchAndLoad('pos', queryStringArr[3], 0));

    // orgTree.empty();
    // orgContent.hide();
    // $("tbody", orgContent).empty();

    return Promise.all(searchPromise)
      .then(function (results) {
        const finded = results.reduce(function (acc, cur) {
          return acc + cur.length;
        }, 0);
        if (finded == 0) {
          $('.not-found', template).removeClass('hidden');
        } else {
          $('.not-found', template).addClass('hidden');
        }
        const presentPromises = [];
        const orgObj = results[0];
        const depObj = results[1];
        const appObj = results[2];
        const posObj = results[3];
        if (orgObj.length > 0) resultOrg.show();
        if (depObj.length > 0) resultDep.show();
        if (appObj.length > 0) resultApp.show();
        if (posObj.length > 0) resultPos.show();
        presentPromises.push(presentSearchResult('org', resultOrg, orgObj));
        presentPromises.push(presentSearchResult('dep', resultDep, depObj));
        presentPromises.push(presentSearchResult('app', resultApp, appObj));
        presentPromises.push(presentSearchResult('pos', resultPos, posObj));
        return Promise.all(presentPromises);
      })
      .then(function () {
        if ($('section#OrgStructure .section-header .glyphicon', template).hasClass('glyphicon-chevron-down')) {
          $('section#OrgStructure .section-header').click();
        }
        loadIndicator.hide();
        return true;
      });
  });

  function genQueryStringArray (searchText, findDeleted, findInParentOrg) {
    const selectPart = 'SELECT DISTINCT target.id';
    const endingPart =
      " GROUP BY target.id, target.rdfs_label_str, target.version HAVING sum(target.sign) > 0 order by arraySort(x -> endsWith(lowerUTF8(x), '@en'), target.rdfs_label_str) asc";
    let basicWherePart = findDeleted ? ' WHERE target.v_s_deleted_int=[1]' : ' WHERE target.v_s_deleted_int=[0] ';
    const orgJoinPart = ' LEFT JOIN veda_tt.`v-s:Organization` as org ON org.id=target.`v_s_parentOrganization_str`[1]';
    const conditionForOrg = ' and org.`v_s_actualContacts_int`[1]=1';
    if (findInParentOrg) {
      basicWherePart += " AND target.v_s_parentOrganization_str=['" + individual['v-s:managedOrganization'][0].id + "']";
    }
    let organizationQuery = selectPart + ' FROM veda_tt.`v-s:Organization` AS target';
    let departmentQuery = selectPart + ' FROM veda_tt.`v-s:Department` AS target' + orgJoinPart;
    let appointmentQuery =
      selectPart + ' FROM veda_tt.`v-s:Appointment` as target INNER JOIN veda_tt.`v-s:Person` as per ON target.v_s_employee_str[1] = per.id' + orgJoinPart;
    let specialPositionQuery = selectPart + ' FROM veda_tt.`v-s:Position` AS target' + orgJoinPart;

    let isCommMeanJoinAdded = false;
    // var isPhoneChannelAdded = false;
    // var isEmailChannelAdded = false;
    const queryParts = searchText.split(' ').reduce(
      function (qParts, sText) {
        sText = sText.toLowerCase();
        const isPhoneSearch = sText.match('^' + String.fromCharCode(92) + '+?[' + String.fromCharCode(92) + 'd-' + String.fromCharCode(92) + 's]*$') != null;
        const isEmailSearch = sText.match('^.*@{1}') != null;
        if (isPhoneSearch || isEmailSearch) {
          if (!isCommMeanJoinAdded) {
            isCommMeanJoinAdded = true;
            organizationQuery += ' INNER JOIN veda_tt.`v-s:CommunicationMean` as cm ON cm.v_s_backwardTarget_str = [target.id]';
            departmentQuery += ' INNER JOIN veda_tt.`v-s:CommunicationMean` as cm ON cm.v_s_backwardTarget_str = [target.id]';
            appointmentQuery += ' INNER JOIN veda_tt.`v-s:CommunicationMean` as cm ON cm.v_s_backwardTarget_str = [per.id]';
            specialPositionQuery += ' INNER JOIN veda_tt.`v-s:CommunicationMean` as cm ON cm.v_s_backwardTarget_str = [target.id]';
            // organizationQuery += " LEFT JOIN veda_tt.`v-s:CommunicationMean` as cm ON cm.v_s_backwardTarget_str = [target.id]";
            // departmentQuery += " LEFT JOIN veda_tt.`v-s:CommunicationMean` as cm ON cm.v_s_backwardTarget_str = [target.id]";
            // appointmentQuery += " LEFT JOIN veda_tt.`v-s:CommunicationMean` as cm ON cm.v_s_backwardTarget_str = [per.id]";
            // specialPositionQuery += " LEFT JOIN veda_tt.`v-s:CommunicationMean` as cm ON cm.v_s_backwardTarget_str = [target.id]";
          }
          // if (isPhoneSearch && !isPhoneChannelAdded) {
          //   basicWherePart += " AND (cm.v_s_hasCommunicationMeanChannel_str[1] in ('d:fpxx0hw2gyea8z1dcjc6mxtlg2','d:zhercrddg5yotsbbzr33cfoqfc','d:o3q2gagyvfwh430io88vvb8vel','d:m4vg7pkvcvke9e6loqtb937jhy'))";
          // }
          // if (isEmailSearch && !isEmailChannelAdded) {
          //   basicWherePart += " AND cm.v_s_hasCommunicationMeanChannel_str[1] = 'd:a1iwni0b54fvcz41vuts08bxqsh'";
          // }
          qParts = qParts.map(function (part) {
            return part + " AND (lowerUTF8(cm.v_s_description_str[1]) LIKE '%" + sText + "%' OR lowerUTF8(cm.rdfs_comment_str[1]) LIKE '%" + sText + "%')";
          });
        } else {
          const converted = convertToCyrillic(sText);
          if (converted != sText) {
            qParts[0] += ` AND (lowerUTF8(arrayStringConcat(arrayConcat(rdfs_label_str,v_s_title_str, v_s_shortLabel_str), ' ')) LIKE '%${sText}%' OR lowerUTF8(arrayStringConcat(arrayConcat(rdfs_label_str,v_s_title_str, v_s_shortLabel_str), ' ')) LIKE '%${converted}%')`;
            qParts[1] += ` AND (lowerUTF8(arrayStringConcat(arrayConcat(rdfs_label_str,v_s_title_str, v_s_shortLabel_str), ' ')) LIKE '%${sText}%' OR lowerUTF8(arrayStringConcat(arrayConcat(rdfs_label_str,v_s_title_str, v_s_shortLabel_str), ' ')) LIKE '%${converted}%')`;
            qParts[2] += ` AND (lowerUTF8(arrayStringConcat(arrayConcat(target.rdfs_label_str,per.v_s_middleName_str), ' ')) LIKE '%${sText}%' OR lowerUTF8(arrayStringConcat(arrayConcat(target.rdfs_label_str,per.v_s_middleName_str), ' ')) LIKE '%${converted}%')`;
            qParts[3] += ` AND (lowerUTF8(arrayStringConcat(arrayConcat(target.rdfs_label_str,target.rdfs_comment_str), ' ')) LIKE '%${sText}%' OR lowerUTF8(arrayStringConcat(arrayConcat(target.rdfs_label_str,target.rdfs_comment_str), ' ')) LIKE '%${converted}%')`;
          } else {
            qParts[0] += " AND lowerUTF8(arrayStringConcat(arrayConcat(rdfs_label_str,v_s_title_str, v_s_shortLabel_str), ' ')) LIKE '%" + sText + "%'";
            qParts[1] += " AND lowerUTF8(arrayStringConcat(arrayConcat(rdfs_label_str,v_s_title_str, v_s_shortLabel_str), ' ')) LIKE '%" + sText + "%'";
            qParts[2] += " AND lowerUTF8(arrayStringConcat(arrayConcat(target.rdfs_label_str,per.v_s_middleName_str), ' ')) LIKE '%" + sText + "%'";
            qParts[3] += " AND lowerUTF8(arrayStringConcat(arrayConcat(target.rdfs_label_str,target.rdfs_comment_str), ' ')) LIKE '%" + sText + "%'";
          }
        }
        return qParts;
      },
      ['', '', '', ''],
    );
    if (isCommMeanJoinAdded) {
      basicWherePart += ' AND cm.v_s_deleted_int = [0]';
    }
    organizationQuery = findInParentOrg ?
      null :
      organizationQuery +
        basicWherePart +
        queryParts[0] +
        " AND v_s_hasCommunicationMean_str[1]!=''" +
        ' and target.`v_s_actualContacts_int`[1]=1' +
        endingPart;
    departmentQuery += basicWherePart + queryParts[1] + conditionForOrg + endingPart;
    appointmentQuery +=
      basicWherePart +
      queryParts[2] +
      " AND target.v_s_official_int=[1] AND NOT(lowerUTF8(arrayStringConcat(target.v_s_origin_str, '')) LIKE '%group%')" +
      conditionForOrg +
      endingPart;
    specialPositionQuery +=
      basicWherePart + queryParts[3] + " AND lowerUTF8(arrayStringConcat(target.v_s_origin_str, ' ')) LIKE '%group%'" + conditionForOrg + endingPart;
    return [organizationQuery, departmentQuery, appointmentQuery, specialPositionQuery];
  }

  function convertToCyrillic (text) {

    const cyrillic = 'йцукенгшщзхъфывапролджэячсмитьбюё';
    const latin = 'qwertyuiop[]asdfghjkl;\'zxcvbnm,.\`';
    return text.toLowerCase().split('').map(char => {
      const index = latin.indexOf(char);
      return index >= 0 ? cyrillic[index] : char;
    }).join('');
  };

  function presentSearchResult (objType, container, items) {
    const promises = items.map(function (item) {
      return item.present($('<div></div>'), 'v-s:ContactCardTemplate');
    });
    return Promise.all(promises).then(function (templates) {
      templates.forEach(function (tmpl) {
        if (isContactManager) $('.zoom.hidden', tmpl).removeClass('hidden');
        if (individual.hasValue('v-s:managedOrganization')) {
          $(".hideInStructure span[rel='v-s:parentOrganization']", tmpl).remove();
        }
        $('tbody', container).append(tmpl);
      });
      $('span.badge:nth-child(4)', container).text(searchHelperObj[objType].estimated);
      $('span.badge:nth-child(2)', container).text(searchHelperObj[objType].handlered);
      if ($('tbody tr', container).length < searchHelperObj[objType].estimated) {
        $('div.result-info-container', container).removeClass('hidden');
      } else {
        $('div.result-info-container', container).addClass('hidden');
      }
    });
  }

  function searchAndLoad (objType, queryString, from, top) {
    let sort;
    if (objType == 'app') {
      sort = "'rdfs:label_ru' asc";
    } else {
      sort = "'rdfs:label' asc";
    }
    if (!top) top = userDisplayedElements;
    // TODO если в консоли не появляется то удалить
    if (objType == 'phone' || objType == 'email') console.log('This is search ', objType);
    const searchObj = {
      ticket: veda.ticket,
      sql: queryString,
      sort: sort,
      from: from,
      top: top,
      limit: 200,
      async: true,
    };
    searchHelperObj[objType].query = queryString;
    return Backend.query(searchObj)
      .then(function (searchResult) {
        searchHelperObj[objType].estimated = searchResult.estimated;
        searchHelperObj[objType].handlered = searchHelperObj[objType].handlered + searchResult.count;
        let loadPromises = [];
        loadPromises = searchResult.result.map(function (uri) {
          return new IndividualModel(uri).load();
        });
        return Promise.all(loadPromises);
      })
      .catch(function (err) {
        console.error('Backend query failed');
        return [];
      });
  }

  function openRow (row) {
    const uri = row.attr('resource');
    return drawChildren(uri, row).then(function (childrenCount) {
      const chevron = row.children('.item').find('a');
      if (childrenCount == 0) {
        chevron.removeClass('glyphicon-chevron-right glyphicon-chevron-down');
      } else {
        chevron.toggleClass('expanded glyphicon-chevron-right glyphicon-chevron-down');
      }
      $('#resizeLine', template).height(Math.max(orgContent.height(), orgTree.height()));
      return true;
    });
  }

  function initPopover (target) {
    const uri = target.closest('[resource]').attr('resource');
    const tmpl = "<div><a tabindex='0' role='button' class='to-structure' about='@' property='rdfs:label'/></div>";
    return getParentUnitChain(new IndividualModel(uri))
      .then(function (chain) {
        const presentPromises = chain.map(function (parent) {
          return parent.present($('<div></div>'), tmpl);
        });
        if (presentPromises.length == 0) {
          presentPromises.push(new IndividualModel(uri).present($('<div></div>'), tmpl));
        }
        return Promise.all(presentPromises);
      })
      .then(function (templates) {
        const cntr = templates.reduceRight(function (acc, curTmpl, i) {
          curTmpl.style.marginLeft = 15 * (templates.length - (i + 1)) + 'px';
          return acc.append(curTmpl);
        }, $("<div><span class='close'>&nbsp;&times;</span></div>"));
        return cntr;
      });
  }

  let openedPopover;
  template.on('click', 'span.open-structure', function (e) {
    e.stopPropagation();
    e.preventDefault();
    const self = $(this);
    initPopover($(this)).then(function (content) {
      self.popover({
        trigger: 'manual focus',
        placement: 'auto right',
        html: true,
        content: content,
        container: template,
      });
      content.on('click', '.close', function (e) {
        e.stopPropagation();
        //openedPopover = undefined;
        self.popover('hide');
        self.attr('data-popovered', false);
      });
      //openedPopover = self;
      self.popover('show');
      self.attr('data-popovered', true);
    });

    // return openFromStructure(uri);
  });

  template.on('click', 'a.to-structure', function (e) {
    e.stopPropagation();
    e.preventDefault();
    // openedPopover.popover('hide');
    // openedPopover.attr('data-popovered', false);
    // openedPopover = undefined;
    const uri = $(this).attr('about');
    const section = $(this).closest('section');
    $('.section-header', section).click();
    return openFromStructure(uri);
  });

  template.on('click', 'a.expand.glyphicon-chevron-right', function (e) {
    e.stopPropagation();
    e.preventDefault();
    const row = $(this).closest('div.value-row');
    return openRow(row);
  });

  template.on('click', 'a.expanded.glyphicon-chevron-down', function (e) {
    e.stopPropagation();
    e.preventDefault();
    const self = $(this);
    self.toggleClass('expanded glyphicon-chevron-right glyphicon-chevron-down');
    const row = self.closest('div.value-row');
    row.children('div.children').addClass('hidden');
    return false;
  });

  template.on('click', 'div.value-row', function (e) {
    e.stopPropagation();
    e.preventDefault();
    const self = $(this);

    const item = self.children('.item');
    if (!item.hasClass('warning')) {
      $('.item.warning', template).removeClass('warning');
      item.addClass('warning');
    }
    const uri = self.attr('resource');
    return drawCards(new IndividualModel(uri));
  });

  template.on('dblclick', '#orgContent tbody tr', function (e) {
    const uri = $(this).attr('resource');
    if (uri == undefined) {
      console.error('Unexpected behavior: empty attr[resource]');
      return false;
    }
    return new IndividualModel(uri).load().then(function (loaded) {
      if (!loaded.hasValue('rdf:type', 'v-s:Department') && !loaded.hasValue('rdf:type', 'v-s:OrgGroup')) {
        return false;
      }
      return Promise.resolve()
        .then(function () {
          const rowInTree = $("#orgTree .children:not(.hidden)>div.value-row[resource='" + uri + "']", template);
          if (rowInTree.length == 0) {
            const parent = $('#orgTree div.item.warning', template).parent();
            return openRow(parent).then(function () {
              return $("div.value-row[resource='" + uri + "']", parent);
            });
          }
          return rowInTree;
        })
        .then(function (row) {
          row.click();
          return true;
        });
    });
  });

  template.on('click', '.result-info-container .more-results', function (e) {
    const self = $(this);
    const type = self.data('search-type');
    const query = searchHelperObj[type].query;
    const from = searchHelperObj[type].handlered;
    return searchAndLoad(type, query, from).then(function (result) {
      const container = self.closest('section');
      return presentSearchResult(type, container, result);
    });
  });

  template.on('click', '.result-info-container .all-results', function (e) {
    const self = $(this);
    const type = self.data('search-type');
    const query = searchHelperObj[type].query;
    const from = searchHelperObj[type].handlered;
    return searchAndLoad(type, query, from, 200).then(function (result) {
      const container = self.closest('section');
      return presentSearchResult(type, container, result);
    });
  });

  template.on('click', 'a.glyphicon-zoom-in', function (e) {
    e.stopPropagation();
    e.preventDefault();
    const self = $(this);
    const uri = self.closest('[resource]').attr('resource');
    let obj = new IndividualModel(uri);
    let tmpl;
    if (obj.hasValue('rdf:type', 'v-s:Appointment')) {
      obj = obj['v-s:employee'][0];
      tmpl = undefined;
    } else if (obj.hasValue('rdf:type', 'v-s:Department')) {
      tmpl = 'v-s:DepartmentTemplate';
    } else if (obj.hasValue('rdf:type', 'v-s:Organization')) {
      tmpl = undefined;
    }
    BrowserUtil.showModal(obj, tmpl);
    return false;
  });

  // Ctrl + Enter triggers search
  function ctrlEnterHandler (e) {
    // if (e.ctrlKey && e.keyCode === 13) {
    //   $("#searchButton", template).click();
    // }
    if (e.keyCode === 13) {
      $('#searchButton', template).click();
    }
  }
  $(window).on('keyup', ctrlEnterHandler);
  template.one('remove', function () {
    $(window).off('keyup', ctrlEnterHandler);
  });

  function dropResultTables () {
    const resultOrg = $('#resultOrg', template).hide();
    $('tbody', resultOrg).empty();
    const resultDep = $('#resultDep', template).hide();
    $('tbody', resultDep).empty();
    const resultApp = $('#resultApp', template).hide();
    $('tbody', resultApp).empty();
    const resultPos = $('#resultPos', template).hide();
    $('tbody', resultPos).empty();
  }

  individual.on('v-s:managedOrganization', function () {
    searchOrgMode = individual.hasValue('v-s:managedOrganization') ? 'targetOrg' : 'allOrg';
    dropResultTables();

    const searchText = $('#searchText input', template).val();
    if (searchText != '') {
      $('#searchButton', template).click();
    }
    initialStructure().then(function (result) {
      if (result == false) return;
      if ($('section#OrgStructure .section-header .glyphicon', template).hasClass('glyphicon-chevron-right')) {
        $('section#OrgStructure .section-header', template).click();
      }
      return drawCards(individual['v-s:managedOrganization'][0]);
    });
  });
  template.one('remove', function () {
    individual.off('v-s:managedOrganization');
  });

  $('#searchText .clear', template).click(function () {
    $('#searchText input', template).val('');
    dropResultTables();
  });

  $('#resetButton', template).click(function () {
    $('#searchText input', template).val('');
    dropResultTables();
    individual['v-s:managedOrganization'] = [];
  });

  if (individual.targetToCards) {
    return openFromStructure(individual.targetToCards);
  } else {
    return initialStructure().then(function (result) {
      if (result == false) return;
      return drawCards(individual['v-s:managedOrganization'][0]);
    });
  }
};

export const html = `
  <div>
    <style>
      div.value-row > div.item {
        padding: 8px;
        white-space: nowrap;
        overflow-x: hidden;
        text-overflow: clip;
      }
      div.item:hover {
        background-color: #fcf8e3;
      }
      div.warning {
        background-color: #faf2cc;
      }
      #searchText input {
        border-top-left-radius: 4px;
        border-bottom-left-radius: 4px;
      }
      .children {
        border-left: 1px dashed #eee;
        padding-left: 8px;
        margin-left: 14px;
      }
      /*#orgContent {
      background-color: #fff;
    }*/
      #resizeLine {
        position: absolute;
        float: left;
        width: 3px;
        height: 100%;
        cursor: col-resize;
        background-color: #ddd;
      }
      /*.result-table thead {
        background-color: #f5f5f5;
      }*/

      .section-header > span.glyphicon {
        margin-right: 5%;
      }

      div.result-info-container {
        margin-top: -20px;
      }
    </style>
    <div class="row  margin-md">
      <div class="col-md-3">
        <!-- <veda-control id="searchText" property="*" data-type="string"></veda-control> -->
        <div id="searchText" class="input-group">
          <input type="text" class="form-control" />
          <div class="input-group-addon btn btn-default clear" tabindex="0">✕</div>
        </div>
        <div class="margin-sm">
          <button id="searchButton" class="btn btn-primary" type="button" about="v-fs:Find" property="rdfs:label"></button>
          <button id="resetButton" class="btn btn-default" type="button" about="v-s:Reset" property="rdfs:label"></button>
        </div>
      </div>
      <div class="col-md-4">
        <veda-control
          data-type="link"
          rel="v-s:managedOrganization"
          data-template="{@.rdfs:label}, {@.v-s:taxId}"
          class="fulltext dropdown"
          data-query-prefix="('rdf:type' === 'v-s:Organization' || 'rdf:type'==='v-s:Subsidiary') && 'v-s:actualContacts'=='true'"></veda-control>
        <span class="text-muted padding-md" about="v-s:FastInputBundle" property="rdfs:label"></span>
        <button id="selfOrg" class="btn btn-xs btn-primary margin-sm">+<span></span></button>
        <button id="tenant" class="btn btn-xs btn-primary margin-sm">
          <span>+</span>
          <span about="v-s:vedaInfo" rel="v-s:tenant" data-template="v-ui:LabelTemplate"></span>
        </button>
      </div>
    </div>
    <div class="not-found alert alert-warning hidden">
      <strong about="v-fs:Empty" property="rdfs:label"></strong>
      <span about="v-fs:NothingFound" property="rdfs:label"></span>
    </div>
    <section id="resultOrg" style="display: none">
      <h5 class="section-header">
        <span class="glyphicon glyphicon-chevron-right"></span>
        <label about="v-s:OrganizationsBundle" property="rdfs:label"></label>
        <small class="margin-md-h" style="color:black; font-weight: normal">
          <span about="v-fs:cursor" property="rdfs:label"></span>
          <span class="badge"></span>&nbsp;&nbsp;
          <span about="v-fs:estimated" property="rdfs:label"></span>
          <span class="badge"></span>
        </small>
      </h5>
      <div class="section-content">
        <table class="table result-table">
          <tbody></tbody>
        </table>
        <div class="result-info-container">
          <button class="btn btn-primary more-results" data-search-type="org" about="v-fs:MoreResults" property="rdfs:label"></button>
          <button class="btn btn-warning all-results" data-search-type="org" about="v-fs:AllResults" property="rdfs:label"></button>
          <small class="margin-sm-h" style="color:black">
            <span about="v-fs:cursor" property="rdfs:label"></span>
            <span class="badge"></span>&nbsp;&nbsp;
            <span about="v-fs:estimated" property="rdfs:label"></span>
            <span class="badge"></span>
          </small>
        </div>
      </div>
    </section>
    <section id="resultDep" style="display: none">
      <h5 class="section-header">
        <span class="glyphicon glyphicon-chevron-right"></span>
        <label about="v-s:DepartmentsBundle" property="rdfs:label"></label>
        <small class="margin-md-h" style="color:black; font-weight: normal">
          <span about="v-fs:cursor" property="rdfs:label"></span>
          <span class="badge"></span>&nbsp;&nbsp;
          <span about="v-fs:estimated" property="rdfs:label"></span>
          <span class="badge"></span>
        </small>
      </h5>
      <div class="section-content">
        <table class="table result-table">
          <tbody></tbody>
        </table>
        <div class="result-info-container">
          <button class="btn btn-primary more-results" data-search-type="dep" about="v-fs:MoreResults" property="rdfs:label"></button>
          <button class="btn btn-warning all-results" data-search-type="dep" about="v-fs:AllResults" property="rdfs:label"></button>
          <small class="margin-sm-h" style="color:black">
            <span about="v-fs:cursor" property="rdfs:label"></span>
            <span class="badge"></span>&nbsp;&nbsp;
            <span about="v-fs:estimated" property="rdfs:label"></span>
            <span class="badge"></span>
          </small>
        </div>
      </div>
    </section>
    <section id="resultPos" style="display: none">
      <h5 class="section-header">
        <span class="glyphicon glyphicon-chevron-right"></span>
        <label about="v-s:PositionsBundle" property="rdfs:label"></label>
        <small class="margin-md-h" style="color:black; font-weight: normal">
          <span about="v-fs:cursor" property="rdfs:label"></span>
          <span class="badge"></span>&nbsp;&nbsp;
          <span about="v-fs:estimated" property="rdfs:label"></span>
          <span class="badge"></span>
        </small>
      </h5>
      <div class="section-content">
        <table class="table result-table">
          <tbody></tbody>
        </table>
        <div class="result-info-container">
          <button class="btn btn-primary more-results" data-search-type="pos" about="v-fs:MoreResults" property="rdfs:label"></button>
          <button class="btn btn-warning all-results" data-search-type="pos" about="v-fs:AllResults" property="rdfs:label"></button>
          <small class="margin-sm-h" style="color:black">
            <span about="v-fs:cursor" property="rdfs:label"></span>
            <span class="badge"></span>&nbsp;&nbsp;
            <span about="v-fs:estimated" property="rdfs:label"></span>
            <span class="badge"></span>
          </small>
        </div>
      </div>
    </section>
    <section id="resultApp" style="display: none">
      <h5 class="section-header">
        <span class="glyphicon glyphicon-chevron-down"></span>
        <label about="v-s:AppointmentsBundle" property="rdfs:label"></label>
        <small class="margin-md-h" style="color:black; font-weight: normal">
          <span about="v-fs:cursor" property="rdfs:label"></span>
          <span class="badge"></span>&nbsp;&nbsp;
          <span about="v-fs:estimated" property="rdfs:label"></span>
          <span class="badge"></span>
        </small>
      </h5>
      <div class="section-content">
        <table class="table result-table">
          <thead>
            <th></th>
            <th><span about="rdfs:label" property="rdfs:label"></span></th>
            <th></th>
            <th>
              <div class="row">
                <div about="d:o3q2gagyvfwh430io88vvb8vel" property="rdfs:label" class="col-lg-2 col-md-12"></div>
                <div about="d:a1iwni0b54fvcz41vuts08bxqsh" property="rdfs:label" class="col-lg-5 col-md-12" style="overflow-x: hidden;"></div>
                <div about="d:fpxx0hw2gyea8z1dcjc6mxtlg2" property="rdfs:label" class="other-phone col-lg-5 col-md-12"></div>  
              </div>
              <!-- <span about="v-s:ContactsBundle" property="rdfs:label"></span> -->
            </th>
            <th></th>
          </thead>
          <tbody></tbody>
        </table>
        <div class="result-info-container">
          <button class="btn btn-primary more-results" data-search-type="app" about="v-fs:MoreResults" property="rdfs:label"></button>
          <button class="btn btn-warning all-results" data-search-type="app" about="v-fs:AllResults" property="rdfs:label"></button>
          <small class="margin-sm-h" style="color:black">
            <span about="v-fs:cursor" property="rdfs:label"></span>
            <span class="badge"></span>&nbsp;&nbsp;
            <span about="v-fs:estimated" property="rdfs:label"></span>
            <span class="badge"></span>
          </small>
        </div>
      </div>
    </section>
    <section id="OrgStructure" style="display: none;">
      <h5 class="section-header">
        <span class="glyphicon glyphicon-chevron-down"></span>
        <label about="v-s:Contacts" property="rdfs:comment"></label>
      </h5>
      <div class="section-content">
        <div id="orgTree" class="col-md-3" style="padding-right:0px"></div>
        <div id="orgContent" class="col-md-9" style="padding-left:5px">
          <div id="resizeLine"></div>
          <div>
            <div id="parentContainer" class="warning padding-md">
              <div about="@" property="rdfs:label"></div>
              <div about="@" rel="v-s:hasCommunicationMean">
                <div>
                  <strong about="@" rel="v-s:hasCommunicationMeanChannel" data-template="v-ui:LabelTemplate"></strong>
                  <span about="@" property="v-s:description"></span>
                </div>
              </div>
            </div>
            <table class="table table-hover">
              <thead>
                <th></th>
                <th><span about="rdfs:label" property="rdfs:label"></span></th>
                <th>
                  <div class="row">
                    <div about="d:o3q2gagyvfwh430io88vvb8vel" property="rdfs:label" class="col-lg-2 col-md-12"></div>
                    <div about="d:a1iwni0b54fvcz41vuts08bxqsh" property="rdfs:label" class="col-lg-5 col-md-12" style="overflow-x: hidden;"></div>
                    <div about="d:fpxx0hw2gyea8z1dcjc6mxtlg2" property="rdfs:label" class="other-phone col-lg-5 col-md-12"></div>  
                  </div>
                  <!-- <span about="v-s:ContactsBundle" property="rdfs:label"></span> -->
                </th>
                <th></th>
              </thead>
              <tbody></tbody>
            </table>
            <div class="result-info-container margin-md-h">
              <button id="showMoreCards" class="btn btn-primary" about="v-fs:MoreResults" property="rdfs:label"></button>
              <button id="showAllCards" class="btn btn-warning" about="v-fs:AllResults" property="rdfs:label"></button>
              <small class="margin-md-h" style="color:black">
                <span about="v-fs:cursor" property="rdfs:label"></span>
                <span class="badge"></span>&nbsp;&nbsp;
                <span about="v-fs:estimated" property="rdfs:label"></span>
                <span class="badge"></span>
              </small>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
`;
