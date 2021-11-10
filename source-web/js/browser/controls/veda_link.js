// Link control

import $ from 'jquery';

import IndividualModel from '../../common/individual_model.js';

import Util from '../../common/util.js';

import {interpolate, ftQuery, renderValue} from './veda_control_util.js';

$.fn.veda_link = function ( options ) {
  const self = this;
  const opts = {...defaults, ...options};
  const control = $(opts.template);
  const template = this.attr('data-template') || '{@.rdfs:label}';
  const individual = opts.individual;
  const spec = opts.spec;
  const placeholder = this.attr('placeholder') || ( spec && spec.hasValue('v-ui:placeholder') ? spec['v-ui:placeholder'].map(Util.formatValue).join(' ') : new IndividualModel('v-s:StartTypingBundle') );
  const rel_uri = opts.property_uri;
  const rangeRestriction = spec && spec.hasValue('v-ui:rangeRestriction') ? spec['v-ui:rangeRestriction'][0] : undefined;
  const range = rangeRestriction ? [rangeRestriction] : new IndividualModel(rel_uri)['rdfs:range'];
  const queryPrefix = this.attr('data-query-prefix') || ( spec && spec.hasValue('v-ui:queryPrefix') ? spec['v-ui:queryPrefix'][0].toString() : range.map((item) => {
    return '\'rdf:type\'===\'' + item.id + '\'';
  }).join(' || ') );
  const source = this.attr('data-source') || undefined;
  const sort = this.attr('data-sort') || ( spec && spec.hasValue('v-ui:sort') && spec['v-ui:sort'][0].toString() );
  let isSingle = this.attr('data-single') || ( spec && spec.hasValue('v-ui:maxCardinality') ? spec['v-ui:maxCardinality'][0] === 1 : true );
  let withDeleted = false || this.attr('data-deleted');

  const tabindex = this.attr('tabindex');
  if (tabindex) {
    this.removeAttr('tabindex');
    control.find('textarea').attr('tabindex', tabindex);
  }

  if (template) {
    this.removeAttr('data-template');
  }

  // Select value
  const select = function (selected) {
    selected = selected instanceof Array ? selected : [selected];
    if (isSingle) {
      individual.set(rel_uri, [selected[0]]);
    } else {
      const filtered = selected.filter((i) => {
        return individual.get(rel_uri).indexOf(i) < 0;
      });
      individual.set(rel_uri, individual.get(rel_uri).concat(filtered));
    }
  };

  const createValue = function () {
    const newVal = new IndividualModel();
    newVal['rdf:type'] = rangeRestriction ? [rangeRestriction] : [(new IndividualModel(rel_uri))['rdfs:range'][0]];
    return newVal;
  };

  // Create feature
  const create = $('.create', control);
  if ( this.hasClass('create') || this.hasClass('full') ) {
    const inModal = this.hasClass('create-modal');
    const rel_range = rangeRestriction ? rangeRestriction : (new IndividualModel(rel_uri))['rdfs:range'][0];
    rel_range.rights.then((rights) => {
      if ( !rights.hasValue('v-s:canCreate', true) && opts.mode !== 'search' ) {
        create.addClass('disabled');
        create.off('click keyup');
      } else {
        create.on('click keydown', function (e) {
          if (e.type !== 'click' && e.which !== 13 && e.which !== 32) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          const newVal = createValue();
          if ( inModal ) {
            let modal = $('#individual-modal-template').html();
            modal = $(modal).modal({'show': false});
            $('body').append(modal);
            modal.modal('show');
            const ok = $('#ok', modal).click((e) => {
              select(newVal);
            });
            const close = $('.close', modal).click((e) => {
              newVal.delete();
            });
            const cntr = $('.modal-body', modal);
            newVal.one('beforeReset', function () {
              modal.modal('hide').remove();
            });
            newVal.one('afterSave', function () {
              select(newVal);
              modal.modal('hide').remove();
            });
            newVal.present(cntr, undefined, 'edit').then((tmpl) => {
              $('.action', tmpl).remove();
              const validation = tmpl.data('validation');
              if ( validation && validation.state ) {
                ok.removeAttr('disabled');
              } else {
                ok.attr('disabled', 'disabled');
              }
              tmpl.on('internal-validated', function (e, validation) {
                if (validation.state) {
                  ok.removeAttr('disabled');
                } else {
                  ok.attr('disabled', 'disabled');
                }
              });
            });
          } else {
            select(newVal);
          }
        });
      }
    });


    // Hide create button for single value relations if value exists
    if (isSingle) {
      const singleValueHandler = function (values) {
        if (values.length) {
          create.hide();
        } else {
          create.show();
        }
      };
      individual.on(rel_uri, singleValueHandler);
      self.one('remove', function () {
        individual.off(rel_uri, singleValueHandler);
      });
      singleValueHandler(individual.get(rel_uri));
    }
  } else {
    create.remove();
  }

  // Tree feature
  const tree = $('.tree', control);
  if ( this.hasClass('tree') || this.hasClass('full') ) {
    const treeTmpl = new IndividualModel('v-ui:TreeTemplate');
    const modal = $('#individual-modal-template').html();
    tree.on('click keydown', function (e) {
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
  } else {
    tree.remove();
  }

  // Fulltext search feature
  let selected = [];
  const fulltext = $('.fulltext', control);
  const fulltextMenu = $('.fulltext-menu', control);
  if ( this.hasClass('fulltext') || this.hasClass('full') ) {
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
          individual.set(rel_uri, selected);
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
        const isSingle = false || $(e.delegateTarget).data('single');
        if (isSingle) {
          header.hide();
        } else {
          header.show();
        }
      }
    });

    const performSearch = function (value) {
      if (source) {
        return Promise.resolve(eval(source))
          .then(renderResults)
          .catch((error) => {
            console.log('Source error', source);
          });
      } else {
        interpolate(queryPrefix, individual).then((queryPrefix) => {
          ftQuery(queryPrefix, value, sort, withDeleted)
            .then(renderResults)
            .catch((error) => {
              console.log('Fulltext query error', error);
            });
        });
      }
    };

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

    const renderResults = function (results) {
      suggestions.empty();
      selected = individual.get(rel_uri);
      if (results.length) {
        const promises = results.map((value) => {
          return renderValue(value, template).then((rendered) => {
            const tmpl = $('<a href=\'#\' class=\'suggestion\'></a>')
              .text( rendered )
              .attr('resource', value.id);
            if (individual.hasValue(rel_uri, value)) {
              tmpl.addClass('selected');
            }
            if (value.hasValue('v-s:deleted', true)) {
              tmpl.addClass('deleted');
            }
            if (value.hasValue('v-s:valid', false) && !value.hasValue('v-s:deleted', true) ) {
              tmpl.addClass('invalid');
            }
            return tmpl;
          });
        });
        Promise.all(promises).then((renderedList) => {
          suggestions.append(renderedList);
          $(document).off('click', clickOutsideMenuHandler);
          $(document).off('keydown', arrowHandler);
          fulltextMenu.show();
          $(document).on('click', clickOutsideMenuHandler);
          $(document).on('keydown', arrowHandler);
        });
      } else {
        fulltextMenu.hide();
        $(document).off('click', clickOutsideMenuHandler);
        $(document).off('keydown', arrowHandler);
      }
    };

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

    const clickHandler = function (e) {
      e.preventDefault();
      const tmpl = $(e.target);
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
          individual.set(rel_uri, [suggestion]);
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
          individual.set(rel_uri, selected);
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
    };

    const dblclickHandler = function (e) {
      e.preventDefault();
      if ( !$(e.target).hasClass('selected') ) {
        clickHandler(e);
      }
      dblTimeout = clearTimeout(dblTimeout);
      individual.set(rel_uri, selected);
      fulltextMenu.hide();
      $(document).off('click', clickOutsideMenuHandler);
      $(document).off('keydown', arrowHandler);
      fulltext.focus();
    };

    const clickOutsideMenuHandler = function (e) {
      if ( !$(e.target).closest(fulltextMenu).length ) {
        if ( fulltextMenu.is(':visible') ) {
          individual.set(rel_uri, selected);
          fulltextMenu.hide();
          $(document).off('click', clickOutsideMenuHandler);
          $(document).off('keydown', arrowHandler);
        }
      }
    };

    const arrowHandler = function (e) {
      if ( e.which === 40 ) { // Down
        e.preventDefault();
        const active = suggestions.find('.active').removeClass('active');
        const next = active.next();
        if ( next.length ) {
          next.addClass('active').focus();
        } else {
          suggestions.children().first().addClass('active').focus();
        }
      } else if ( e.which === 38 ) { // Up
        e.preventDefault();
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
    };

    const propertyModifiedHandler = function (value) {
      if ( isSingle && individual.hasValue(rel_uri) ) {
        individual.get(rel_uri)[0].load()
          .then((value) => renderValue(value, template))
          .then((rendered) => {
            const value = fulltext.val();
            if (value != rendered) {
              fulltext.val(rendered);
            }
          });
      } else {
        fulltext.val('');
      }
    };

    individual.on(rel_uri, propertyModifiedHandler);
    self.one('remove', function () {
      individual.off(rel_uri, propertyModifiedHandler);
    });
    propertyModifiedHandler();

    // Dropdown feature
    const dropdown = $('.dropdown', control);
    if ( this.hasClass('dropdown') && this.hasClass('fulltext') || this.hasClass('full') ) {
      dropdown.on('click keydown', function (e) {
        if (e.type !== 'click' && e.which !== 13 && e.which !== 32) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const suggestions = $('.suggestions', control);
        if ( suggestions.is(':empty') ) {
          performSearch();
        } else if ( fulltextMenu.is(':visible') ) {
          fulltextMenu.hide();
          $(document).off('click', clickOutsideMenuHandler);
          $(document).off('keydown', arrowHandler);
        } else {
          $(document).off('click', clickOutsideMenuHandler);
          $(document).off('keydown', arrowHandler);
          fulltextMenu.show();
          $(document).on('click', clickOutsideMenuHandler);
          $(document).on('keydown', arrowHandler);
        }
      });
      const downHandler = function (e) {
        if ( e.which === 40) {
          e.stopPropagation();
          dropdown.click();
        }
      };
      fulltext.on('focus', function (e) {
        fulltext.off('keydown', downHandler).one('keydown', downHandler);
      });
    } else {
      dropdown.remove();
    }
  } else {
    fulltext.remove();
    fulltextMenu.remove();
    $('.dropdown', control).remove();
  }

  // Clear feature
  if (isSingle && opts.mode !== 'search' && ( this.hasClass('fulltext') || this.hasClass('full') ) ) {
    $('.clear', control).on('click keydown', function (e) {
      if (e.type !== 'click' && e.which !== 13 && e.which !== 32) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      selected = [];
      $('.suggestions', control).empty();
      individual.clearValue(rel_uri);
      fulltext.val('').focus();
    });
    this.on('view edit search', function (e) {
      e.stopPropagation();
      if (e.type === 'search') {
        const isSingle = false || $(e.delegateTarget).data('single');
        if (!isSingle) {
          $('.clear', control).remove();
        }
      }
    });
  } else {
    $('.clear', control).remove();
  }

  if ( !$('.fulltext', control).length ) {
    $('.input-group', control).toggleClass('input-group btn-group');
    $('.input-group-addon', control).toggleClass('input-group-addon btn-default btn-primary');
  }

  this.on('view edit search', function (e) {
    e.stopPropagation();
    if (e.type === 'search') {
      isSingle = false || $(e.delegateTarget).data('single');
      const dataDeleted = $(e.delegateTarget).data('deleted');
      withDeleted = typeof dataDeleted === 'boolean' ? dataDeleted : true;
    }
  });

  if (spec && spec.hasValue('v-ui:tooltip')) {
    control.tooltip({
      title: spec['v-ui:tooltip'].join(', '),
      placement: 'top',
      container: 'body',
      trigger: 'manual',
      animation: false,
    });
    this.one('remove', () => control.tooltip('destroy'));
    $('textarea', control)
      .on('focusin', () => control.tooltip('show'))
      .on('focusout change', () => control.tooltip('hide'));
  }

  this.append(control);
  return this;
};

const defaults = {
  template: `
<div class="link-control">
  <div class="input-group">
    <div class="input-group-addon btn btn-default tree" tabindex="0">
      <i class="fa fa-sitemap"></i>
    </div>
    <textarea rows="1" class="form-control fulltext"></textarea>
    <div class="input-group-addon btn btn-default clear" tabindex="0">&#10005;</div>
    <div class="input-group-addon btn btn-default dropdown" tabindex="0">
      <i class="caret"></i>
    </div>
    <div class="input-group-addon btn btn-default create" tabindex="0">
      <i class="glyphicon glyphicon-plus"></i>
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
