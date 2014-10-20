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

    var oWebworkerModule = angular.module('ngWebworker', []);

    oWebworkerModule.service('webworker', ['$q', function($q) {
        this.create = function(worker, config) {
            var URL = window.URL || window.webkitURL,
                aFuncParts,
                strWorker,
                blob,
                retWorker;

            if (Worker && URL && URL.createObjectURL && (Blob || BlobBuilder || WebKitBlobBuilder || MozBlobBuilder)) {
                if (typeof worker == "function") {
                    aFuncParts = /function\s*(\w+)(.*)/.exec(worker.toString());
                    strWorker = worker.toString();

                    strWorker += "self.onmessage=function(e){" +
                        "postMessage({type:'return', data:" + aFuncParts[1] + ".apply(null,e.data)})" +
                        "};";

                    if (Blob) {
                        blob = new Blob([complete, notify, strWorker], {type: 'application/javascript'});
                    } else if (BlobBuilder || WebKitBlobBuilder || MozBlobBuilder) { // Backwards-compatibility
                        // WARNING: This isn't tested because I can't find a browser to test it on.
                        window.BlobBuilder = BlobBuilder || WebKitBlobBuilder || MozBlobBuilder;
                        blob = new BlobBuilder();
                        blob.append(complete);
                        blob.append(notify);
                        blob.append(strWorker);
                        blob = blob.getBlob();
                    }

                    retWorker = new WebworkerGenerator(URL.createObjectURL(blob), config);

                } else {
                    // assume it is a string, and hope for the best
                    retWorker = new WebworkerGenerator(worker, config);
                }
            } else {
                // we can't do webworkers.
                // FUTURE: Lets shim it. Maybe a timeout?
            }

            return retWorker;
        };

        function WebworkerGenerator(worker, config) {
            this.oWorker = new Worker(worker);
            this.config = config || {};
        }

        WebworkerGenerator.prototype.run = function() {
            var oDeferred = $q.defer(),
                self = this;

            this.oWorker.onmessage = function (oEvent) {
                if (oEvent.data.type == "return") {
                    if (!self.config.async) {
                        oDeferred.resolve(oEvent.data.data);
                    }
                    if (typeof self.config.onReturn == "function") {
                        self.config.onReturn(oEvent.data.data);
                    }
                } else if (oEvent.data.type == "complete") {
                    oDeferred.resolve(oEvent.data.data);
                    if (typeof self.config.onComplete == "function") {
                        self.config.onComplete(oEvent.data.data);
                    }
                } else if (oEvent.data.type == "notice") {
                    if (typeof self.config.onNotice == "function") {
                        self.config.onNotice(oEvent.data.data);
                    }
                }
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
