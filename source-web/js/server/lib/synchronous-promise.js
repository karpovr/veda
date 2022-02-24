// https://github.com/fluffynuts/synchronous-promise
(function (global) {
  'use strict';
  const PENDING = 'pending';
  const RESOLVED = 'resolved';
  const REJECTED = 'rejected';

  function SynchronousPromise (handler) {
    this.status = PENDING;
    this._continuations = [];
    this._parent = null;
    this._paused = false;
    if (handler) {
      handler.call(
        this,
        this._continueWith.bind(this),
        this._failWith.bind(this),
      );
    }
  }

  function looksLikeAPromise (obj) {
    return obj && typeof (obj.then) === 'function';
  }

  SynchronousPromise.prototype = {
    then: function (nextFn, catchFn) {
      const next = SynchronousPromise.unresolved()._setParent(this);
      if (this._isRejected()) {
        if (this._paused) {
          this._continuations.push({
            promise: next,
            nextFn: nextFn,
            catchFn: catchFn,
          });
          return next;
        }
        if (catchFn) {
          try {
            const catchResult = catchFn(this._error);
            if (looksLikeAPromise(catchResult)) {
              this._chainPromiseData(catchResult, next);
              return next;
            } else {
              return SynchronousPromise.resolve(catchResult)._setParent(this);
            }
          } catch (e) {
            return SynchronousPromise.reject(e)._setParent(this);
          }
        }
        return SynchronousPromise.reject(this._error)._setParent(this);
      }
      this._continuations.push({
        promise: next,
        nextFn: nextFn,
        catchFn: catchFn,
      });
      this._runResolutions();
      return next;
    },
    catch: function (handler) {
      if (this._isResolved()) {
        return SynchronousPromise.resolve(this._data)._setParent(this);
      }
      const next = SynchronousPromise.unresolved()._setParent(this);
      this._continuations.push({
        promise: next,
        catchFn: handler,
      });
      this._runRejections();
      return next;
    },
    pause: function () {
      this._paused = true;
      return this;
    },
    resume: function () {
      const firstPaused = this._findFirstPaused();
      if (firstPaused) {
        firstPaused._paused = false;
        firstPaused._runResolutions();
        firstPaused._runRejections();
      }
      return this;
    },
    _findAncestry: function () {
      return this._continuations.reduce(function (acc, cur) {
        if (cur.promise) {
          const node = {
            promise: cur.promise,
            children: cur.promise._findAncestry(),
          };
          acc.push(node);
        }
        return acc;
      }, []);
    },
    _setParent: function (parent) {
      if (this._parent) {
        throw new Error('parent already set');
      }
      this._parent = parent;
      return this;
    },
    _continueWith: function (data) {
      const firstPending = this._findFirstPending();
      if (firstPending) {
        firstPending._data = data;
        firstPending._setResolved();
      }
    },
    _findFirstPending: function () {
      return this._findFirstAncestor(function (test) {
        return test._isPending && test._isPending();
      });
    },
    _findFirstPaused: function () {
      return this._findFirstAncestor(function (test) {
        return test._paused;
      });
    },
    _findFirstAncestor: function (matching) {
      let test = this;
      let result;
      while (test) {
        if (matching(test)) {
          result = test;
        }
        test = test._parent;
      }
      return result;
    },
    _failWith: function (error) {
      const firstRejected = this._findFirstPending();
      if (firstRejected) {
        firstRejected._error = error;
        firstRejected._setRejected();
      }
    },
    _takeContinuations: function () {
      return this._continuations.splice(0, this._continuations.length);
    },
    _runRejections: function () {
      if (this._paused || !this._isRejected()) {
        return;
      }
      const
        error = this._error;
      const continuations = this._takeContinuations();
      const self = this;
      continuations.forEach(function (cont) {
        if (cont.catchFn) {
          try {
            const catchResult = cont.catchFn(error);
            self._handleUserFunctionResult(catchResult, cont.promise);
          } catch (e) {
            cont.promise.reject(e);
          }
        } else {
          cont.promise.reject(error);
        }
      });
    },
    _runResolutions: function () {
      if (this._paused || !this._isResolved()) {
        return;
      }
      const continuations = this._takeContinuations();
      if (looksLikeAPromise(this._data)) {
        return this._handleWhenResolvedDataIsPromise(this._data);
      }
      const data = this._data;
      const self = this;
      continuations.forEach(function (cont) {
        if (cont.nextFn) {
          try {
            const result = cont.nextFn(data);
            self._handleUserFunctionResult(result, cont.promise);
          } catch (e) {
            self._handleResolutionError(e, cont);
          }
        } else if (cont.promise) {
          cont.promise.resolve(data);
        }
      });
    },
    _handleResolutionError: function (e, continuation) {
      this._setRejected();
      if (continuation.catchFn) {
        try {
          continuation.catchFn(e);
          return;
        } catch (e2) {
          e = e2;
        }
      }
      if (continuation.promise) {
        continuation.promise.reject(e);
      }
    },
    _handleWhenResolvedDataIsPromise: function (data) {
      const self = this;
      return data.then(function (result) {
        self._data = result;
        self._runResolutions();
      }).catch(function (error) {
        self._error = error;
        self._setRejected();
        self._runRejections();
      });
    },
    _handleUserFunctionResult: function (data, nextSynchronousPromise) {
      if (looksLikeAPromise(data)) {
        this._chainPromiseData(data, nextSynchronousPromise);
      } else {
        nextSynchronousPromise.resolve(data);
      }
    },
    _chainPromiseData: function (promiseData, nextSynchronousPromise) {
      promiseData.then(function (newData) {
        nextSynchronousPromise.resolve(newData);
      }).catch(function (newError) {
        nextSynchronousPromise.reject(newError);
      });
    },
    _setResolved: function () {
      this.status = RESOLVED;
      if (!this._paused) {
        this._runResolutions();
      }
    },
    _setRejected: function () {
      this.status = REJECTED;
      if (!this._paused) {
        this._runRejections();
      }
    },
    _isPending: function () {
      return this.status === PENDING;
    },
    _isResolved: function () {
      return this.status === RESOLVED;
    },
    _isRejected: function () {
      return this.status === REJECTED;
    },
  };

  SynchronousPromise.resolve = function (result) {
    return new SynchronousPromise(function (resolve, reject) {
      if (looksLikeAPromise(result)) {
        result.then(function (newResult) {
          resolve(newResult);
        }).catch(function (error) {
          reject(error);
        });
      } else {
        resolve(result);
      }
    });
  };

  SynchronousPromise.reject = function (result) {
    return new SynchronousPromise(function (resolve, reject) {
      reject(result);
    });
  };

  SynchronousPromise.unresolved = function () {
    return new SynchronousPromise(function (resolve, reject) {
      this.resolve = resolve;
      this.reject = reject;
    });
  };

  SynchronousPromise.all = function (...args) {
    if (Array.isArray(args[0])) {
      args = args[0];
    }
    if (!args.length) {
      return SynchronousPromise.resolve([]);
    }
    return new SynchronousPromise(function (resolve, reject) {
      const
        allData = [];
      let numResolved = 0;
      const doResolve = function () {
        if (numResolved === args.length) {
          resolve(allData);
        }
      };
      let rejected = false;
      const doReject = function (err) {
        if (rejected) {
          return;
        }
        rejected = true;
        reject(err);
      };
      args.forEach(function (arg, idx) {
        SynchronousPromise.resolve(arg).then(function (thisResult) {
          allData[idx] = thisResult;
          numResolved += 1;
          doResolve();
        }).catch(function (err) {
          doReject(err);
        });
      });
    });
  };

  if (Promise === SynchronousPromise) {
    throw new Error('Please use SynchronousPromise.installGlobally() to install globally');
  }
  const RealPromise = Promise;
  SynchronousPromise.installGlobally = function (__awaiter) {
    if (Promise === SynchronousPromise) {
      return __awaiter;
    }
    const result = patchAwaiterIfRequired(__awaiter);
    Promise = SynchronousPromise;
    return result;
  };

  SynchronousPromise.uninstallGlobally = function () {
    if (Promise === SynchronousPromise) {
      Promise = RealPromise;
    }
  };

  function patchAwaiterIfRequired (__awaiter) {
    if (typeof(__awaiter) === 'undefined' || __awaiter.__patched) {
      return __awaiter;
    }
    const originalAwaiter = __awaiter;
    __awaiter = function (...args) {
      originalAwaiter.apply(this, args);
    };
    __awaiter.__patched = true;
    return __awaiter;
  }

  global.Promise = SynchronousPromise;
})(this);
