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
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

    describe("ngWebworker", function() {
        var Webworker, $q, $rootScope;

        beforeEach(function() {
            // needed before inject()
            module('ngWebworker');
        });

        beforeEach(inject(function(_webworker_, _$q_, _$rootScope_) {
            Webworker = _webworker_;
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
                    oWorker = Webworker.create(fib, oConfig);

                spyOn(oConfig, 'onNotice').and.callThrough();

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
                oWorker = Webworker.create(timers, oConfig);

            spyOn(oConfig, 'onReturn');

            oWorker.run(iTime, iCalls).then(function(result) {
                expect(result).toEqual(iCalls);
                expect(oConfig.onReturn).toHaveBeenCalledWith(undefined);
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

    function timers(iTime, iNotices) {
        var iFinished = iNotices,
            iCalls = 0;
        while (iNotices--) {
            setTimeout(function() {
                notify(iCalls);
                if (++iCalls == iFinished) {
                    complete(iCalls, iTime);
                }
            }, iTime * (iNotices + 1));
        }
    }

    // here so we can use fib outside the worker
    function notify() {}

});
