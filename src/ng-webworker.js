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
        CONST_RETURN = "return";

    oWebworkerModule.service('Webworker', ['$q', function($q) {
        this.create = function(worker, config) {
            var URL = window.URL || window.webkitURL,
                aFuncParts,
                strWorker,
                blob,
                retWorker;
            config = config || {};

            if (Worker && URL && URL.createObjectURL && (Blob || BlobBuilder || WebKitBlobBuilder || MozBlobBuilder)) {
                if (typeof worker == CONST_FUNCTION) {
                    aFuncParts = /function\s*(\w+)(.*)/.exec(worker.toString());
                    strWorker = worker.toString();

                    strWorker += "onmessage=function(e){" +
                        "postMessage({type:'"+ CONST_RETURN +"', data:" + aFuncParts[1] + ".apply(null,e.data)})" +
                        "};";

                    if (typeof Blob === CONST_FUNCTION) {
                        blob = new Blob([complete, notify, strWorker], {type: 'application/javascript'});
                    } else if (window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder) { // Backwards-compatibility
                        // WARNING: This isn't tested well because I can can't find any
                        //          other browser other than PhantomJS to test with
                        window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;
                        blob = new BlobBuilder();
                        blob.append(complete);
                        blob.append(notify);
                        blob.append(strWorker);
                        blob = blob.getBlob();
                    }

                    // stupid IE thinks Blob Webworkers violate same-origin
                    try {
                        retWorker = new WebworkerGenerator(URL.createObjectURL(blob), config);
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
            this.oWorker = new Worker(worker);
            // setup default events so they will always be there
            this.config = angular.extend({
                onMessage: noop,
                onReturn: noop,
                onComplete: noop,
                onNotice: noop
            }, config);

            // support webworker lowercase style
            if (config.onmessage) {
                this.config.onMessage = config.onmessage;
            }
        }

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

                    oDeferred.notify(oData);
                    self.config.onMessage(oData);

                    if (strType == CONST_RETURN) {
                        if (!self.config.async) {
                            oDeferred.resolve(oData);
                        }
                        self.config.onReturn(oData);
                    } else if (strType == "complete") {
                        oDeferred.resolve(oData);
                        self.config.onComplete(oData);
                    } else if (strType == "notice") {
                        self.config.onNotice(oData);
                    }
                }
            };

            this.oWorker.onerror = function(oError) {
                oDeferred.reject(oError);
            };

            //FUTURE: Use Array.slice(arguments) when available for V8 optimization
            this.oWorker.postMessage(Array.prototype.slice.call(arguments));

            return oDeferred.promise;
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
