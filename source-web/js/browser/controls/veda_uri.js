// Uri control

import $ from 'jquery';

$.fn.veda_uri = function ( options ) {
  const opts = $.extend( {}, $.fn.veda_uri.defaults, options );
  const control = $( opts.template );
  const individual = opts.individual;

  const tabindex = this.attr('tabindex');
  if (tabindex) {
    this.removeAttr('tabindex');
    control.attr('tabindex', tabindex);
  };

  this.on('view edit search', function (e) {
    e.stopPropagation();
  });

  control.attr({
    'placeholder': individual.id,
  }).on('change focusout', changeHandler);

  /**
   * Input change handler
   * @return {void}
   */
  function changeHandler () {
    if (control.val()) {
      individual.id = control.val();
    };
  }

  individual.on('idChanged', function () {
    control.attr('placeholder', individual.id);
  });

  this.append(control);
  return this;
};
$.fn.veda_uri.defaults = {
  template: $('#string-control-template').html(),
};
