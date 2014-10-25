/**
 * @license ng-webworker v0.1.0
 * (c) 2014 Matt Slocum
 * License: MIT
 * Jasmine Tests
 */
define([
    'src/ng-webworker',
    "angular-mocks"
], function(ngWebworker) {
    'use strict';
//    jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

    describe("ngWebworker", function() {
        var Webworker, $q, $rootScope;

        beforeEach(function() {
            // needed before inject()
            module('ngWebworker');
        });

        beforeEach(inject(function(_Webworker_, _$q_, _$rootScope_) {
            Webworker = _Webworker_;
            $q = _$q_;
            $rootScope = _$rootScope_;
        }));

        it('should register ngWebworker as a module and service', function() {
            expect(ngWebworker).not.toBeNull();
            expect(ngWebworker).toBeDefined();
            expect(Webworker).not.toBeNull();
            expect(Webworker).toBeDefined();
        });

        describe('should convert a simple function to a webworker', function() {
            it('with a promise', function(done) {
                var oWorker = Webworker.create(fib);

                oWorker.run(12).then(function(result) {
                    expect(result).toEqual(144);
                    done();
                });

                // $q needs a digest so lets call one after the worker should be finished
                // a different test will test event functions
                // This isn't needed in a real angular app.
                setTimeout(function() {
                    $rootScope.$digest();
                }, 100);

            });

            it('with events', function(done) {
                var iMessages = 3,
                    oConfig = {
                        onReturn: function(result) {
                            expect(result).toEqual(144);
                            // $q needs a digest
                            $rootScope.$digest();
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

        it('should convert an async function to a webworker', function(done) {
            var iTime = 50,
                iCalls = 4,
                iNotices = 0,
                oConfig = {
                    async: true,
                    onReturn: function() {},
                    onComplete: function(result) {
                        expect(result).toEqual(iCalls);
                        // $q needs a digest
                        $rootScope.$digest();
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

        describe('should load an external webworker', function() {
            it('that is plain', function(done) {
                var oWorker = Webworker.create('/base/test/worker.fib.js');

                oWorker.run(12).then(function(result) {
                    expect(result).toEqual(144);
                    done();
                });

                // $q needs a digest so lets call one after the worker should be finished
                // a different test will test event functions
                // This isn't needed in a real angular app.
                setTimeout(function() {
                    $rootScope.$digest();
                }, 100);
            });

            it('with async events', function(done) {
                var iTime = 50,
                    iCalls = 4,
                    iNotices = 0,
                    oConfig = {
                        async: true,
                        onComplete: function(result) {
                            expect(result).toEqual(iCalls);
                            // $q needs a digest
                            $rootScope.$digest();
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

//            it('should load an external webworker', function(done) {
//                var iTime = 50,
//                    iCalls = 4,
//                    oWorker = Webworker.create('/base/test/worker.timer.js', {
//
//                    });
//
//                oWorker.run(iTime, iCalls).then(function(result) {
//                    done();
//                }, null, function(notice) {
//                    console.log("notice", notice);
//                });
//
//                // $q needs a digest so lets call one after the worker should be finished
//                // a different test will test event functions
//                // This isn't needed in a real angular app.
//                setTimeout(function() {
//                    $rootScope.$digest();
//                }, iTime * (iCalls + 1));
//            });
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

});
