define([], function() {
    'use strict';

    var mockDefer = function () {
        return {
            finished: false,
            resolve: function (data) {
                if (this.finished) return;
                this.promise._callbacks.thens.forEach((function(cb) {
                    cb(data);
                }));
                this.promise._callbacks.finalies.forEach((function(cb) {
                    cb(data);
                }));
                this.finished = true;
            },
            notify: function () {
                
            },
            reject: function (data) {
                if (this.finished) return;
                this.promise._callbacks.catches.forEach((function(cb) {
                    cb(data);
                }));
                this.promise._callbacks.finalies.forEach((function(cb) {
                    cb(data);
                }));
                this.finished = true;
            },
            promise: {
                _callbacks: {
                    thens: [],
                    catches: [],
                    finalies: []
                },

                then: function (cb) {
                    this._callbacks.thens.push(cb);
                    return this;
                },
                catch: function (cb) {
                    this._callbacks.catches.push(cb);
                    return this;
                },
                finally: function (cb) {
                    this._callbacks.finalies.push(cb);
                    return this;
                }
            }
        }
    };

    return {
        defer: mockDefer
    };
});