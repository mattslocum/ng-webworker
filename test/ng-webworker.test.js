/**
 * License: MIT
 * Jasmine Tests
 */
define([
    'src/ng-webworker',
    'src/angularjs',
    'angular-mocks',
    'node_modules/es6-promise/dist/es6-promise.auto'
], function(ngWebworker) {
    'use strict';
    // uncomment to make it easier to debug
//    jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

    // set the global helperPath that Karma uses
    ngWebworker.NgWebWorker.helperPath = "base/src/" + ngWebworker.NgWebWorker.helperPath;

    // https://stackoverflow.com/a/26888312/1314079
    var strUserAgent = navigator.userAgent;
    var userAgentProp = { get: function () { return strUserAgent; } };
    try {
        Object.defineProperty(window.navigator, 'userAgent', userAgentProp);
    } catch (e) {
        window.navigator = Object.create(navigator, {
            userAgent: userAgentProp
        });
    }

    describe("ngWebworker", function() {
        var Webworker;

        beforeEach(function() {
            Webworker = new ngWebworker.NgWebWorker.NgWebWorkerService();
        });

        it('should export ngWebworker NgWebWorkerService', function() {
            expect(Webworker).toBeDefined();
        });

        it('should register ngWebworker as an angularjs module and service', function() {
            angular.mock.module('ngWebworker');

            inject(function(Webworker) {
                expect(Webworker).not.toBeNull();
                expect(Webworker).toBeDefined();
                expect(Webworker.create).toBeDefined();
            });
        });

        describe('should convert a simple function to a webworker', function() {
            it('with a promise', function(done) {
                var oWorker = Webworker.create(fib);

                oWorker.run(12).then(function(result) {
                    expect(result).toEqual(144);
                    done();
                });
            });

            it('with events', function(done) {
                var iMessages = 3,
                    oConfig = {
                        onReturn: function(result) {
                            expect(result).toEqual(144);
                        },
                        onNotice: function(message) {
                            expect(message).toEqual(fib(iMessages++));
                        },
                        onComplete: jasmine.createSpy('spy')
                    },
                    oWorker;

                spyOn(oConfig, 'onNotice').and.callThrough();

                oWorker = Webworker.create(fib, oConfig);

                oWorker.run(12).then(function(result) {
                    expect(result).toEqual(144);
                    expect(oConfig.onNotice).toHaveBeenCalled();
                    expect(oConfig.onComplete).not.toHaveBeenCalled();
                    done();
                });
            });
        });

        describe('should convert an anonimous function to a webworker', function() {
            it('with a promise', function(done) {
                var oWorker = Webworker.create(function(num) {
                    return num * 2;
                });

                oWorker.run(4).then(function(result) {
                    expect(result).toEqual(8);
                    done();
                });
            });

            it('with events', function(done) {
                var iMessages = 3,
                    oConfig = {
                        onReturn: function(result) {
                            expect(result).toEqual(144);
                        },
                        onNotice: function(message) {
                            expect(message).toEqual(fib(iMessages++));
                        },
                        onComplete: jasmine.createSpy('spy')
                    },
                    oWorker;

                spyOn(oConfig, 'onNotice').and.callThrough();

                oWorker = Webworker.create(function(nth) {
                    var previous = 1, current = 1, temp, i;

                    for (i = 3; i <= nth; i++) {
                        temp = current;
                        current = current + previous;
                        previous = temp;
                        notify(current);
                    }
                    nth = current;

                    return nth;
                }, oConfig);

                oWorker.run(12).then(function(result) {
                    expect(result).toEqual(144);
                    expect(oConfig.onNotice).toHaveBeenCalled();
                    expect(oConfig.onComplete).not.toHaveBeenCalled();
                    done();
                });
            });
        });

        describe('should convert a variable style function to a webworker', function() {
            it('with a promise', function(done) {
                var oWorker = Webworker.create(varFib);

                oWorker.run(12).then(function(result) {
                    expect(result).toEqual(144);
                    done();
                });
            });

            it('with events', function(done) {
                var iMessages = 3,
                    oConfig = {
                        onReturn: function(result) {
                            expect(result).toEqual(144);
                        },
                        onNotice: function(message) {
                            expect(message).toEqual(fib(iMessages++));
                        },
                        onComplete: jasmine.createSpy('spy')
                    },
                    oWorker;

                spyOn(oConfig, 'onNotice').and.callThrough();

                oWorker = Webworker.create(varFib, oConfig);

                oWorker.run(12).then(function(result) {
                    expect(result).toEqual(144);
                    expect(oConfig.onNotice).toHaveBeenCalled();
                    expect(oConfig.onComplete).not.toHaveBeenCalled();
                    done();
                });
            });
        });

        describe('should use worker helper for IE', function () {
            var originalUserAgent;

            beforeEach(function() {
                originalUserAgent = navigator.userAgent;
                strUserAgent = 'MSIE';
            });

            afterEach(function() {
                strUserAgent = originalUserAgent;
            });

            it('with promise', function (done) {
                var oWorker = Webworker.create(varFib);

                oWorker.run(12).then(function(result) {
                    expect(result).toEqual(144);
                    done();
                });
            });

            it('with events', function(done) {
                var iMessages = 3,
                    oConfig = {
                        onReturn: function(result) {
                            expect(result).toEqual(144);
                        },
                        onNotice: function(message) {
                            expect(message).toEqual(fib(iMessages++));
                        },
                        onComplete: jasmine.createSpy('spy')
                    },
                    oWorker;

                spyOn(oConfig, 'onNotice').and.callThrough();

                oWorker = Webworker.create(varFib, oConfig);

                oWorker.run(12).then(function(result) {
                    expect(result).toEqual(144);
                    expect(oConfig.onNotice).toHaveBeenCalled();
                    expect(oConfig.onComplete).not.toHaveBeenCalled();
                    done();
                });
            });
        });

        it('should convert an async function to a webworker', function(done) {
            var iTime = 50,
                iCalls = 4,
                iNotices = 0,
                oConfig = {
                    async: true,
                    onReturn: function() {},
                    onComplete: function(result) {
                        expect(result).toEqual(iCalls);
                    },
                    onNotice: function(message) {
                        expect(message).toEqual(iNotices++);
                    }
                },
                oWorker;

            spyOn(oConfig, 'onReturn');

            oWorker = Webworker.create(timers, oConfig);

            oWorker.run(iTime, iCalls).then(function(result) {
                expect(result).toEqual(iCalls);
                expect(iNotices).toEqual(4);
                expect(oConfig.onReturn).toHaveBeenCalledWith(undefined);
                done();
            });
        });

        it('should reject the worker after a stop()', function(done) {
            var oWorker = Webworker.create(function() {
                setTimeout(function() {
                    complete();
                }, 500);
            }, {async: true});

            oWorker.run().then(function() {
                debugger;
                expect("").toEqual("This shouldn't happen");
            }).catch(function() {
                done();
            });

            oWorker.stop();
        });

        describe('should load an external webworker', function() {
            it('that is plain', function(done) {
                var oWorker = Webworker.create('/base/test/worker.fib.js');

                oWorker.run(12).then(function(result) {
                    expect(result).toEqual(144);
                    done();
                });
            });

            it('with async events', function(done) {
                var iTime = 50,
                    iCalls = 4,
                    iNotices = 0,
                    oConfig = {
                        async: true,
                        onComplete: function(result) {
                            expect(result).toEqual(iCalls);
                        },
                        onNotice: function(message) {
                            expect(message).toEqual(iNotices++);
                        }
                    },
                    oWorker;

                oWorker = Webworker.create('/base/test/worker.timer.js', oConfig);

                oWorker.run(iTime, iCalls).then(function(result) {
                    expect(result).toEqual(iCalls);
                    expect(iNotices).toEqual(4);
                    done();
                });
            });
        });

        it('should transfer ownership of ArrayBuffer Objects', function(done) {
            var canvas = document.createElement('canvas'),
                context = canvas.getContext('2d'),
                imgData,
                oWorker;
            canvas.width = 100;
            canvas.height = 100;
            imgData = context.getImageData(0,0,canvas.width,canvas.height);

            oWorker = Webworker.create(function(imgDataBuffer) {
                // phantomjs doesn't have Uint8ClampedArray
                var imgData = new Uint8Array(imgDataBuffer);
                // image pixels are [r,g,b,a] all strung together
                for (var pixel = 0; pixel < imgData.length; pixel += 4) {
                    imgData[pixel] = 255;
                    imgData[pixel + 1] = 0;
                    imgData[pixel + 2] = 0;
                    imgData[pixel + 3] = 255;
                }
                // image should be all red
                return imgData.buffer;
            });


            oWorker.run(imgData.data.buffer).then(function(imgDataBuffer) {
                var imgDataResult = new Uint8Array(imgDataBuffer);

                // make sure the below loop is going to run
                expect(imgDataResult.length).toEqual(40000);

                for (var pixel = 0; pixel < imgDataResult.length; pixel += 4) {
                    expect(imgDataResult[pixel]).toEqual(255);
                    expect(imgDataResult[pixel + 1]).toEqual(0);
                    expect(imgDataResult[pixel + 2]).toEqual(0);
                    expect(imgDataResult[pixel + 3]).toEqual(255);
                }

                // See if the old data is gone because it was transferred
                expect(imgData.data.length).toEqual(0);

                done();
            });
        });
    });

    function fib(nth) {
        var previous = 1, current = 1, temp, i;

        for (i = 3; i <= nth; i++) {
            temp = current;
            current = current + previous;
            previous = temp;
            notify(current);
        }
        nth = current;

        return nth;
    }
    // here so we can use fib outside the worker
    function notify() {}


    function timers(iTime, iNotices) {
        var iFinished = iNotices,
            iCalls = 0;
        while (iNotices--) {
            setTimeout(function() {
                notify(iCalls);
                if (++iCalls == iFinished) {
                    complete(iCalls);
                }
            }, iTime * (iNotices + 1));
        }
    }

    var varFib = function(nth){
        var previous = 1, current = 1, temp, i;

        for (i = 3; i <= nth; i++) {
            temp = current;
            current = current + previous;
            previous = temp;
            notify(current);
        }
        nth = current;

        return nth;
    };

});
