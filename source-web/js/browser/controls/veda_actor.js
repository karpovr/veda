// Actor control

import $ from 'jquery';

import IndividualModel from '../../common/individual_model.js';

import Util from '../../common/util.js';

import {interpolate, ftQuery} from './veda_control_util.js';

$.fn.veda_actor = function ( options ) {
  const opts = {...defaults, ...options};
  const control = $( opts.template );
  const individual = opts.individual;
  const rel_uri = opts.property_uri;
  const spec = opts.spec;
  const placeholder = this.attr('data-placeholder') || ( spec && spec.hasValue('v-ui:placeholder') ? spec['v-ui:placeholder'].map(Util.formatValue).join(' ') : new IndividualModel('v-s:StartTypingBundle') );
  const specQueryPrefix = this.attr('data-query-prefix') || ( spec && spec.hasValue('v-ui:queryPrefix') ? spec['v-ui:queryPrefix'][0].toString() : undefined);
  let queryPrefix;
  const sort = this.attr('data-sort') || ( spec && spec.hasValue('v-ui:sort') && spec['v-ui:sort'][0].toString() );
  const actorType = this.attr('data-actor-type') || 'v-s:Appointment v-s:Person v-s:Position v-s:Department';
  const complex = this.attr('data-complex') || false;
  let isSingle = this.attr('data-single') || ( spec && spec.hasValue('v-ui:maxCardinality') ? spec['v-ui:maxCardinality'][0] === 1 : true );
  const withDeleted = false || this.attr('data-deleted');
  let chosenActorType;
  let fullName;
  let onlyDeleted;

  const tabindex = this.attr('tabindex');
  if (tabindex) {
    this.removeAttr('tabindex');
    control.find('textarea').attr('tabindex', tabindex);
  }

  // Fulltext search feature
  const fulltext = $('.fulltext', control);
  const fulltextMenu = $('.fulltext-menu', control);

  // Disable closing actor type dropdown on click
  $('.dropdown-menu', control).click((e) => {
    e.stopPropagation();
  });

  // Close actor type dropdown on input click
  fulltext.click(() => {
    $('.dropdown-toggle', control).attr('aria-expanded', false).parent().removeClass('open');
  });

  // Filter allowed actor types, set label & handler
  $('[name=\'actor-type\']', control).filter((i, el) => {
    if (actorType.indexOf(el.value) < 0) {
      $(el).closest('.radio').remove();
      return false;
    } else {
      $(el).parent().append( new IndividualModel(el.value).toString() );
      return true;
    }
  }).change((e) => {
    $('.tree', control).hide();
    if ( $(e.target).is(':checked') ) {
      chosenActorType = e.target.value;
      if ( chosenActorType === 'v-s:Appointment' || chosenActorType === 'v-s:Person' || chosenActorType === 'v-s:Position' ) {
        $('[name=\'full-name\']', control).parent().parent().show();
        queryPrefix = '\'rdf:type\' === \'v-s:Appointment\'';
      } else if (chosenActorType === 'v-s:Department') {
        $('[name=\'full-name\']', control).parent().parent().hide();
        queryPrefix = '\'rdf:type\' === \'v-s:Appointment\' || \'rdf:type\' === \'v-s:Department\'';
        $('.tree', control).show();
      }
      queryPrefix = specQueryPrefix || queryPrefix;
      const ftValue = $('.fulltext', control).val();
      if (ftValue) {
        performSearch(ftValue);
      }
    }
  }).first().prop('checked', 'checked').change();

  // Full name check label & handler
  $('[name=\'full-name\']', control).each((i, el) => {
    const label = new IndividualModel(el.value);
    const self = el;
    label.load().then((label) => {
      $(self).parent().append( new IndividualModel(self.value).toString() );
    });
  }).change(() => {
    fullName = $(el).is(':checked') ? true : false;
    const ftValue = $('.fulltext', control).val();
    if (ftValue) {
      performSearch(ftValue);
    }
  });

  $('[name=\'only-deleted\']', control).each((i, el) => {
    const label = new IndividualModel(el.value);
    const self = el;
    label.load().then((label) => {
      $(self).parent().append( new IndividualModel(self.value).toString() );
    });
  }).change(() => {
    onlyDeleted = $(el).is(':checked') ? true : false;
    const ftValue = $('.fulltext', control).val();
    if (ftValue) {
      performSearch(ftValue);
    }
  });

  $('.clear', control).on('click keydown', function (e) {
    if (isSingle) {
      if (e.type !== 'click' && e.which !== 13 && e.which !== 32) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      individual.clearValue(rel_uri);
      if ( complex ) {
        individual.clearValue(rel_uri + '.v-s:employee');
        individual.clearValue(rel_uri + '.v-s:occupation');
      }
    }
    fulltextMenu.hide();
    $(document).off('click', clickOutsideMenuHandler);
    $(document).off('keydown', arrowHandler);
    fulltext.val('').focus();
  });

  // Tree feature
  $('.tree', control).on('click keydown', function (e) {
    const treeTmpl = new IndividualModel('v-ui:TreeTemplate');
    const modal = $('#individual-modal-template').html();
    if (e.type !== 'click' && e.which !== 13 && e.which !== 32) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const $modal = $(modal);
    const cntr = $('.modal-body', $modal);
    $modal.on('hidden.bs.modal', function (e) {
      $modal.remove();
    });
    $modal.modal();
    $('body').append($modal);

    const extra = {
      target: individual,
      target_rel_uri: rel_uri,
      isSingle: isSingle,
      withDeleted: withDeleted,
      sort: sort,
    };
    spec.present(cntr, treeTmpl, undefined, extra);
  });

  if (placeholder instanceof IndividualModel) {
    placeholder.load().then((placeholder) => {
      fulltext.attr({
        'placeholder': placeholder.toString(),
        'name': (individual.hasValue('rdf:type') ? individual['rdf:type'][0].id + '_' + rel_uri : rel_uri).toLowerCase().replace(/[-:]/g, '_'),
      });
    });
  } else {
    fulltext.attr({
      'placeholder': placeholder,
      'name': (individual.hasValue('rdf:type') ? individual['rdf:type'][0].id + '_' + rel_uri : rel_uri).toLowerCase().replace(/[-:]/g, '_'),
    });
  }

  fulltext.on('input change focus blur', function (e) {
    const fulltext = $(e.target);
    const value = fulltext.val();
    if (value) {
      const rows = value.split('\n').length;
      fulltext.prop('rows', rows);
    } else {
      fulltext.prop('rows', 1);
    }
  });

  const header = $('.header', control);
  Promise.all([
    new IndividualModel('v-s:SelectAll').load(),
    new IndividualModel('v-s:CancelSelection').load(),
    new IndividualModel('v-s:InvertSelection').load(),
  ]).then((actions) => {
    header.find('.select-all')
      .click(() => {
        suggestions.children(':not(.selected)').click();
      })
      .text( actions[0].toString() );
    header.find('.cancel-selection')
      .click(() => {
        suggestions.children('.selected').click();
      })
      .text( actions[1].toString() );
    header.find('.invert-selection')
      .click(() => {
        suggestions.children().click();
      })
      .text( actions[2].toString() );
    header.find('.close-menu')
      .click(() => {
        setValue(selected);
        fulltextMenu.hide();
        $(document).off('click', clickOutsideMenuHandler);
        $(document).off('keydown', arrowHandler);
      })
      .text( 'Ok' );
  });
  if (isSingle) {
    header.hide();
  }

  this.on('view edit search', function (e) {
    e.stopPropagation();
    if (e.type === 'search') {
      isSingle = false || $(e.delegateTarget).data('single');
      if (isSingle) {
        header.hide();
      } else {
        header.show();
      }
    }
  });

  const inputHandler = (() => {
    let timeout;
    const minLength = 3;
    const nav_keys = [37, 38, 39, 40, 9, 16]; // Arrows, shift, tab
    return function (e) {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (nav_keys.indexOf(e.which) >= 0) {
        return;
      }
      timeout = setTimeout(() => {
        const value = e.target.value;
        if (value.length >= minLength) {
          performSearch(value);
        } else if (!value.length) {
          if (isSingle) {
            individual.clearValue(rel_uri);
          }
          suggestions.empty();
          fulltextMenu.hide();
          $(document).off('click', clickOutsideMenuHandler);
          $(document).off('keydown', arrowHandler);
        }
      }, 750);
    };
  })();
  fulltext.on('keydown', inputHandler);

  /**
   * Search actors
   * @param {string} value
   * @return {void}
   */
  function performSearch (value) {
    if ( chosenActorType === 'v-s:Appointment' || chosenActorType === 'v-s:Person' || chosenActorType === 'v-s:Position' ) {
      if ( fullName ) {
        value = value.trim().split('\n').map((line) => {
          const fullNameProps = ['v-s:employee.v-s:lastName', 'v-s:employee.v-s:firstName', 'v-s:employee.v-s:middleName'];
          const fullNameInput = line.trim().replace(/\s+/g, ' ').split(' ');
          const fullNameQuery = fullNameInput.map((token, i) => {
            if (i < 3 && token) {
              return '\'' + fullNameProps[i] + '\'==\'' + token + '*\'';
            }
          }).filter(Boolean).join(' && ');
          return fullNameQuery;
        }).join('\n');
      }
    }

    const ftQueryPromise = interpolate(queryPrefix, individual).then((queryPrefix) => {
      if (onlyDeleted) {
        return ftQuery(queryPrefix + ' && \'v-s:deleted\'==\'true\'', value, sort, withDeleted);
      } else {
        return ftQuery(queryPrefix, value, sort, withDeleted);
      };
    });

    ftQueryPromise
      .then(renderResults)
      .catch((error) => {
        console.log('Fulltext query error', error);
      });
  }

  let selected = [];

  /**
   * Render found search results
   * @param {Array} results
   * @return {void}
   */
  function renderResults (results) {
    selected = individual.get(rel_uri).concat(individual.get(rel_uri + '.v-s:employee'), individual.get(rel_uri + '.v-s:occupation'), individual.get(rel_uri + '.v-s:parentUnit'));
    if (results.length) {
      const renderedPromises = results.map((result) => {
        const cont = $('<a href=\'#\' class=\'suggestion\'></a>').attr('resource', result.id);
        if (individual.hasValue(rel_uri, result) || individual.hasValue(rel_uri + '.v-s:employee', result) || individual.hasValue(rel_uri + '.v-s:occupation', result) || individual.hasValue(rel_uri + '.v-s:parentUnit', result)) {
          cont.addClass('selected');
        }
        let tmpl;
        if ( chosenActorType === 'v-s:Department' && result.hasValue('rdf:type', 'v-s:Appointment') ) {
          tmpl = '<span about=\'@\' rel=\'v-s:parentUnit\' data-template=\'v-ui:LabelTemplate\'></span>';
        } else {
          tmpl = '<span about=\'@\' property=\'rdfs:label\'></span>';
        }
        return result.present(cont, tmpl).then(() => cont);
      });
      Promise.all(renderedPromises).then((rendered) => {
        rendered = rendered.sort((a, b) => {
          return a.text() < b.text() ? -1 : 1;
        }).reduce((acc, curr) => {
          if ( !acc.length || acc[acc.length - 1].text() !== curr.text() ) {
            acc.push(curr);
          }
          return acc;
        }, []);
        suggestions.empty().append(rendered);
        $(document).off('click', clickOutsideMenuHandler);
        $(document).off('keydown', arrowHandler);
        fulltextMenu.show();
        $(document).on('click', clickOutsideMenuHandler);
        $(document).on('keydown', arrowHandler);
      }).catch(console.log);
    } else {
      suggestions.empty();
      fulltextMenu.hide();
      $(document).off('click', clickOutsideMenuHandler);
      $(document).off('keydown', arrowHandler);
    }
  }

  const suggestions = $('.suggestions', control);
  let dblTimeout;
  suggestions.on('click', '.suggestion', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (!e.originalEvent) {
      clickHandler(e);
    } else if (dblTimeout) {
      dblclickHandler(e);
    } else {
      clickHandler(e);
    }
  }).on('keydown', '.suggestion', function (e) {
    if (e.which === 32) {
      e.preventDefault();
      e.stopPropagation();
      clickHandler(e);
    } else if (e.which === 13) {
      e.preventDefault();
      e.stopPropagation();
      dblclickHandler(e);
    }
  }).on('dblclick', '.suggestion', function (e) {
    e.preventDefault();
  });

  /**
   * Click event handler
   * @param {Event} e
   * @return {void}
   */
  function clickHandler (e) {
    e.preventDefault();
    const tmpl = $(e.currentTarget);
    const suggestion_uri = tmpl.attr('resource');
    if (!suggestion_uri) {
      return;
    }
    const suggestion = new IndividualModel(suggestion_uri);
    tmpl.toggleClass('selected');
    if (isSingle) {
      tmpl.siblings().removeClass('selected');
    }
    if ( selected.indexOf(suggestion) >= 0 ) {
      if (isSingle) {
        selected = [suggestion];
        setValue(selected);
        fulltextMenu.hide();
        $(document).off('click', clickOutsideMenuHandler);
        $(document).off('keydown', arrowHandler);
      } else {
        selected = selected.filter((value) => {
          return value !== suggestion;
        });
      }
    } else {
      if (isSingle) {
        selected = [suggestion];
        setValue(selected);
        fulltextMenu.hide();
        $(document).off('click', clickOutsideMenuHandler);
        $(document).off('keydown', arrowHandler);
      } else {
        selected.push(suggestion);
      }
    }
    dblTimeout = setTimeout(() => {
      dblTimeout = undefined;
    }, 300);
    fulltext.focus();
  }

  /**
   * Double click event handler
   * @param {Event} e
   * @return {void}
   */
  function dblclickHandler (e) {
    e.preventDefault();
    if ( !$(e.target).hasClass('selected') ) {
      clickHandler(e);
    }
    dblTimeout = clearTimeout(dblTimeout);
    setValue(selected);
    fulltextMenu.hide();
    $(document).off('click', clickOutsideMenuHandler);
    $(document).off('keydown', arrowHandler);
    fulltext.focus();
  }

  /**
   * Click outside menu handler
   * @param {Event} e
   * @return {void}
   */
  function clickOutsideMenuHandler (e) {
    if ( !$(e.target).closest(fulltextMenu).length && e.target !== fulltext[0] ) {
      if ( fulltextMenu.is(':visible') ) {
        if ( selected.length ) {
          setValue(selected);
        }
        fulltextMenu.hide();
        $(document).off('click', clickOutsideMenuHandler);
        $(document).off('keydown', arrowHandler);
      }
    }
  }

  /**
   * Arrow press handler
   * @param {Event} e
   * @return {void}
   */
  function arrowHandler (e) {
    if ( e.which === 40 ) { // Down
      e.preventDefault();
      e.stopPropagation();
      const active = suggestions.find('.active').removeClass('active');
      const next = active.next();
      if ( next.length ) {
        next.addClass('active').focus();
      } else {
        suggestions.children().first().addClass('active').focus();
      }
    } else if ( e.which === 38 ) { // Up
      e.preventDefault();
      e.stopPropagation();
      const active = suggestions.find('.active').removeClass('active');
      const prev = active.prev();
      if ( prev.length ) {
        prev.addClass('active').focus();
      } else {
        suggestions.children().last().addClass('active').focus();
      }
    } else if ( e.which === 32 && fulltextMenu.find(':focus').length ) { // Space
      e.preventDefault(); // Prevent scrolling on space
    }
  }

  /**
   * Set property values to individual
   * @param {Array} values
   * @return {void}
   */
  function setValue (values) {
    if ( complex ) {
      individual.clearValue(rel_uri);
      individual.clearValue(rel_uri + '.v-s:employee');
      individual.clearValue(rel_uri + '.v-s:occupation');
      individual.clearValue(rel_uri + '.v-s:parentUnit');
      if (chosenActorType === 'v-s:Appointment') {
        individual.set(rel_uri, values);
      } else if (chosenActorType === 'v-s:Person') {
        Promise.all(values.map((value) => {
          if ( value.hasValue('rdf:type', 'v-s:Appointment') ) {
            return value['v-s:employee'][0].load();
          } else if ( value.hasValue('rdf:type', 'v-s:Person') ) {
            return value;
          }
        })).then((persons) => {
          individual.set(rel_uri + '.v-s:employee', persons);
        });
      } else if (chosenActorType === 'v-s:Position') {
        Promise.all(values.map((value) => {
          if ( value.hasValue('rdf:type', 'v-s:Appointment') ) {
            return value['v-s:occupation'][0].load();
          } else if ( value.hasValue('rdf:type', 'v-s:Position') ) {
            return value;
          }
        })).then((positions) => {
          individual.set(rel_uri + '.v-s:occupation', positions);
        });
      } else if (chosenActorType === 'v-s:Department') {
        Promise.all(values.map((value) => {
          if ( value.hasValue('rdf:type', 'v-s:Appointment') ) {
            return value['v-s:parentUnit'][0].load();
          } else if ( value.hasValue('rdf:type', 'v-s:Department') ) {
            return value;
          }
        })).then((departments) => {
          individual.set(rel_uri + '.v-s:parentUnit', departments);
        });
      }
    } else {
      individual.clearValue(rel_uri);
      if (chosenActorType === 'v-s:Appointment') {
        individual.set(rel_uri, values);
      } else if (chosenActorType === 'v-s:Person') {
        Promise.all(values.map((value) => {
          if ( value.hasValue('rdf:type', 'v-s:Appointment') ) {
            return value['v-s:employee'][0].load();
          } else if ( value.hasValue('rdf:type', 'v-s:Person') ) {
            return value;
          }
        })).then((persons) => {
          individual.set(rel_uri, persons);
        });
      } else if (chosenActorType === 'v-s:Position') {
        Promise.all(values.map((value) => {
          if ( value.hasValue('rdf:type', 'v-s:Appointment') ) {
            return value['v-s:occupation'][0].load();
          } else if ( value.hasValue('rdf:type', 'v-s:Position') ) {
            return value;
          }
        })).then((positions) => {
          individual.set(rel_uri, positions);
        });
      } else if (chosenActorType === 'v-s:Department') {
        Promise.all(values.map((value) => {
          if ( value.hasValue('rdf:type', 'v-s:Appointment') ) {
            return value['v-s:parentUnit'][0].load();
          } else if ( value.hasValue('rdf:type', 'v-s:Department') ) {
            return value;
          }
        })).then((departments) => {
          individual.set(rel_uri, departments);
        });
      }
    }
  }

  /**
   * Individual property modified event handler
   * @param {Array} values
   * @return {void}
   */
  function propertyModifiedHandler (values) {
    if ( isSingle && (individual.hasValue(rel_uri) || individual.hasValue(rel_uri + '.v-s:employee') || individual.hasValue(rel_uri + '.v-s:occupation') || individual.hasValue(rel_uri + '.v-s:parentUnit')) ) {
      const value = individual.get(rel_uri).concat(individual.get(rel_uri + '.v-s:employee'), individual.get(rel_uri + '.v-s:occupation'), individual.get(rel_uri + '.v-s:parentUnit')).filter(Boolean)[0];
      value.load().then((value) => {
        const newValueStr = value.toString();
        const oldValueStr = fulltext.val();
        if (newValueStr != oldValueStr) {
          fulltext.val(newValueStr);
        }
      });
    } else {
      fulltext.val('');
    }
  }
  individual.on( [rel_uri, rel_uri + '.v-s:employee', rel_uri + '.v-s:occupation', rel_uri + '.v-s:parentUnit'].join(' '), propertyModifiedHandler);
  this.one('remove', function () {
    [rel_uri, rel_uri + '.v-s:employee', rel_uri + '.v-s:occupation', rel_uri + '.v-s:parentUnit'].forEach((prop) => individual.off(prop, propertyModifiedHandler));
  });
  propertyModifiedHandler();

  this.on('view edit search', function (e) {
    e.stopPropagation();
  });
  this.append(control);
  return this;
};

const defaults = {
  template: `
<div class="link-control">
  <div class="input-group">
    <div class="input-group-addon btn btn-default dropdown" style="padding:0;" tabindex="0">
      <span data-toggle="dropdown" id="actor-type-menu" aria-haspopup="true" aria-expanded="true" style="padding:10px;">
        <i class="glyphicon glyphicon-search"></i><i class="caret"></i>
      </span>
      <div class="dropdown-menu actor-type-menu padding-lg-h" aria-labelledby="actor-type-menu">
        <div class="radio">
          <label>
            <input type="radio" name="actor-type" value="v-s:Appointment"/>
          </label>
        </div>
        <div class="radio">
          <label>
            <input type="radio" name="actor-type" value="v-s:Person"/>
          </label>
        </div>
        <div class="radio">
          <label>
            <input type="radio" name="actor-type" value="v-s:Position"/>
          </label>
        </div>
        <div class="radio">
          <label>
            <input type="radio" name="actor-type" value="v-s:Department"/>
          </label>
        </div>
        <hr class="margin-sm">
        <div class="checkbox">
          <label>
            <input type="checkbox" name="only-deleted" value="v-s:OnlyDeleted"/>
          </label>
        </div>
        <div class="checkbox">
          <label>
            <input type="checkbox" name="full-name" value="v-s:FullNameBundle"/>
          </label>
        </div>
      </div>
    </div>
    <div class="input-group-addon btn btn-default tree" tabindex="0">
      <i class="fa fa-sitemap"></i>
    </div>
    <textarea class="form-control fulltext" autocomplete="off" rows="1"></textarea>
    <div class="input-group-addon btn btn-default clear" tabindex="0">
      <span>&#10005;</span>
    </div>
  </div>
  <div class="fulltext-menu">
    <div class="header clearfix">
      <small class="actions pull-left">
        <span class="select-all"></span>
        <span class="cancel-selection"></span>
        <span class="invert-selection"></span>
      </small>
      <small class="actions pull-right">
        <span class="close-menu"></span>
      </small>
    </div>
    <div class="suggestions"></div>
  </div>
</div>
  `,
};
