(function (global) {
  const console = {
    log: logger('LOG'),
    error: logger('ERROR'),
    info: logger('INFO'),
    time: function (timer) {
      this[timer] = new Date();
    },
    timeEnd: function (timer) {
      const delta = new Date() - this[timer];
      this.info(timer, delta, 'msec');
    },
  };
  function logger (NAME) {
    return function (...args) {
      print.apply(global, [NAME + ':'].concat(args));
    };
  }
  global.console = console;
})(this);
