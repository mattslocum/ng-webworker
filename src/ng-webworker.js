/**
 * @license ng-webworker v0.1
 * (c) 2014 Matt Slocum
 * License: MIT
 */
!function (name, context, definition) {
    // CommonJS
    if (typeof module != 'undefined' && module.exports) module.exports = definition();
    // AMD
    else if (typeof define == 'function' && define.amd) define(definition);
    // <script>
    else context[name] = definition()
}('ngWebworker', this, function () {
    'use strict';

    var oWebworkerModule = angular.module('ngWebworker', []),
        CONST_FUNCTION = "function",
        CONST_RETURN = "return",
        CONST_COMPLETE = "complete",
        CONST_NOTICE = "notice";

    oWebworkerModule.config(['$provide', function($provide) {
        $provide.value('WebworkerConfig', {
            "workerPath": "worker_wrapper.js",
            "useHelper": false
        });
    }]);


    oWebworkerModule.service('Webworker', ['$q', 'WebworkerConfig', function($q, WebworkerConfig) {
        this.create = function(worker, config) {
            var win = window,
                URL = win.URL || win.webkitURL,
                aFuncParts,
                strWorker,
                blob,
                retWorker;
            config = config || {};

            config = angular.extend({
                useHelper: WebworkerConfig.useHelper
            }, config);


            // stupid IE thinks Blob Webworkers violate same-origin
            if (navigator.userAgent.indexOf('MSIE') !== -1 || navigator.appVersion.indexOf('Trident/') > 0) {
                config.useHelper = true;
            }

            if (Worker && URL && URL.createObjectURL && (Blob || win.BlobBuilder || win.WebKitBlobBuilder || win.MozBlobBuilder)) {
                if (typeof worker == CONST_FUNCTION) {
                    config.external = false;
                    if (!config.useHelper) {
                        aFuncParts = /function\s*(\w+)(.*)/.exec(worker.toString());
                        strWorker = worker.toString();

                        strWorker += "onmessage=function(e){" +
                            "postMessage({type:'"+ CONST_RETURN +"', data:" + aFuncParts[1] + ".apply(null,e.data)})" +
                            "};";

                        if (typeof win.Blob === CONST_FUNCTION) {
                            blob = new Blob([complete, notify, strWorker], {type: 'application/javascript'});
                        } else if (win.BlobBuilder || win.WebKitBlobBuilder || win.MozBlobBuilder || win.MSBlobBuilder) { // Backwards-compatibility
                            // WARNING: This isn't tested well because I can can't find any
                            //          other browser other than PhantomJS to test with
                            win.BlobBuilder = win.BlobBuilder || win.WebKitBlobBuilder || win.MozBlobBuilder || win.MSBlobBuilder;
                            blob = new BlobBuilder();
                            blob.append(complete);
                            blob.append(notify);
                            blob.append(strWorker);
                            blob = blob.getBlob();
                        }
                    }

                    try {
                        if (config.useHelper) {
                            retWorker = new WebworkerGenerator(worker.toString(), config);
                        } else {
                            retWorker = new WebworkerGenerator(URL.createObjectURL(blob), config);
                        }
                    } catch(e) {}

                } else {
                    // assume it is a string, and hope for the best
                    config.external = true;
                    retWorker = new WebworkerGenerator(worker, config);
                }
//            } else {
                // we can't do webworkers.
                // FUTURE: Lets shim it. Maybe a timeout?
            }

            return retWorker;
        };

        function WebworkerGenerator(worker, config) {
            var noop = function() {};

            if (config.external || !config.useHelper) {
                this.oWorker = new Worker(worker);
            } else {
                this.oWorker = new Worker(WebworkerConfig.workerPath);
                this.strWorkerFunc = worker;
            }

            // setup default events so they will always be there
            this.config = angular.extend({
                onMessage: noop,
                onError: noop,
                onReturn: noop,
                onComplete: noop,
                onNotice: noop
            }, config);

            // support webworker lowercase style
            if (config.onmessage) {
                this.config.onMessage = config.onmessage;
                this.config.onError = config.onerror;
            }
        }

        //TODO: save copy of promise/worker pair so we can terminate
        WebworkerGenerator.prototype.run = function() {
            var oDeferred = $q.defer(),
                self = this;

            this.oWorker.onmessage = function(oEvent) {
                var strType = oEvent.data.type,
                    oData = oEvent.data;

                if (self.config.external && !self.config.async) {
                    oDeferred.resolve(oData);
                } else {
                    oData = oEvent.data.data;

                    // don't notify if we are complete
                    if (strType != "complete") {
                        oDeferred.notify(oData);
                    }
                    self.config.onMessage(oEvent);

                    if (strType == CONST_RETURN) {
                        if (!self.config.async) {
                            oDeferred.resolve(oData);
                        }
                        self.config.onReturn(oData);
                    } else if (strType == CONST_COMPLETE) {
                        oDeferred.resolve(oData);
                        self.config.onComplete(oData);
                    } else if (strType == CONST_NOTICE) {
                        self.config.onNotice(oData);
                    }
                }
            };

            this.oWorker.onerror = function(oError) {
                oDeferred.reject(oError);
            };

            if (self.config.external || !self.config.useHelper) {
                //FUTURE: Use Array.slice(arguments) when available for V8 optimization
                this.oWorker.postMessage(Array.prototype.slice.call(arguments));
            } else {
                //FUTURE: Use Array.slice(arguments) when available for V8 optimization
                this.oWorker.postMessage({
                    fn: self.strWorkerFunc,
                    args: Array.prototype.slice.call(arguments)
                });
            }

            return oDeferred.promise;
        };

        WebworkerGenerator.prototype.stop = function() {
            this.oWorker.onerror(new Error('stopped'));
            this.oWorker.terminate();
        };

        function complete(mVal) {
            postMessage({
                type: "complete",
                data: mVal
            })
        }
        function notify(mVal) {
            postMessage({
                type: "notice",
                data: mVal
            })
        }
    }]);


    return oWebworkerModule;
});
