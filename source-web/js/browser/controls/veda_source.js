// Source control

import $ from 'jquery';

$.fn.veda_source = function (options) {
  const opts = {...defaults, ...options};
  const control = $(opts.template);
  const individual = opts.individual;
  const property_uri = opts.property_uri;
  const editorEl = control.get(0);

  opts.value = individual.hasValue(property_uri) ? individual.get(property_uri)[0].toString() : '';
  opts.change = function (value) {
    individual.set(property_uri, [value]);
  };

  if (typeof this.attr('data-mode') !== 'undefined') opts.sourceMode = this.attr('data-mode');
  if (property_uri === 'v-s:script') opts.sourceMode = 'ace/mode/javascript';
  if (property_uri === 'v-ui:template') opts.sourceMode = 'ace/mode/html';

  const debounce = function (f, ms) {
    let skip = false;
    return function (...args) {
      if (skip) return;
      skip = true;
      setTimeout(() => skip = false, ms);
      return f(...args);
    };
  };

  import('ace').then((module) => {
    const ace = module.default;

    const editor = ace.edit(editorEl, {
      mode: opts.sourceMode,
      readOnly: opts.mode === 'view',
      selectionStyle: 'text',
      fontSize: 14,
      value: opts.value,
    });

    this.on('view edit search', function (e) {
      e.stopPropagation();
      e.type === 'view' ? ( editor.setReadOnly(true) ) :
        e.type === 'edit' ? ( editor.setReadOnly(false) ) :
          e.type === 'search' ? ( editor.setReadOnly(false) ) :
            true;
    });

    const editorHandler = function (delta) {
      const value = opts.parser( editor.session.getValue() );
      opts.change(value);
    };
    const debouncedEditorHandler = debounce(editorHandler, 100);

    editor.session.on('change', debouncedEditorHandler);

    const individualHandler = function (values) {
      const value = opts.parser( editor.session.getValue() );
      if (!values.length || values[0].toString() !== value) {
        editor.setValue( values.length ? values[0].toString() : '' );
      }
    };
    const debouncedIndividualHandler = debounce(individualHandler, 100);

    individual.on(property_uri, debouncedIndividualHandler);
    this.one('remove', function () {
      individual.off(property_uri, debouncedIndividualHandler);
      editor.destroy();
    });
  });

  this.on('view edit search', function (e) {
    e.stopPropagation();
  });

  this.append(control);
  return this;
};

const defaults = {
  value: '',
  template: `<div class="panel panel-default" style="min-height:300px"></div>`,
  mode: 'javascript',
  parser: function (input) {
    return (input || null);
  },
};
