/**
 * ng-webworker - ng-webworker creates dynamic webworkers so angular apps can be multi-threaded.
 * @link https://github.com/mattslocum/ng-webworker
 * @license MIT
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


    oWebworkerModule.provider('Webworker', function() {
        var WebworkerConfig = {
            async: false,
            helperPath: "worker_wrapper.js",
            useHelper: false, // gets set back to true for IE
            transferOwnership: true // if you pass in a ByteArray. Warning: Experimental
        };

        this.setConfig = function(oConfig) {
            angular.extend(WebworkerConfig, oConfig);
        };
        this.setHelperPath = function(strPath) {
            WebworkerConfig.helperPath = strPath;
        };
        this.setUseHelper = function(bUse) {
            WebworkerConfig.useHelper = !!bUse;
        };
        this.setTransferOwnership = function(bTransfer) {
            WebworkerConfig.transferOwnership = !!bTransfer;
        };


        function Webworker($q) {
            var min_safe = {};

            // only use these min_safe functions inside the webworker
            min_safe._transferable_ = function(messageData) {
                var messageDataTransfers = [];

                if (Object.prototype.toString.apply(messageData) != '[object Array]') {
                    messageData = [messageData];
                }

                messageData.forEach(function (data) {
                    if (data instanceof ArrayBuffer) {
                        messageDataTransfers.push(data);
                    }
                });

                return messageDataTransfers;
            };
            min_safe.complete = function(mVal) {
                // _transferable_ is added to the worker
                postMessage(["complete", mVal], self._transferable_(mVal))
            };
            min_safe.notify = function(mVal) {
                postMessage(["notice", mVal])
            };


            this.create = function(worker, config) {
                var win = window,
                    URL = win.URL || win.webkitURL,
                    aFuncParts,
                    strWorker,
                    blob,
                    retWorker;

                config = config || {};

                config = angular.extend(
                    angular.copy(WebworkerConfig),
                    config
                );


                // stupid IE thinks Blob Webworkers violate same-origin
                // stupid Edge thinks it's not IE
                if (navigator.userAgent.indexOf('MSIE') !== -1 ||
                    navigator.userAgent.indexOf('Edge') !== -1 ||
                    navigator.appVersion.indexOf('Trident/') > 0) {
                    config.useHelper = true;
                }

                if (Worker && URL && URL.createObjectURL && (Blob || win.BlobBuilder || win.WebKitBlobBuilder || win.MozBlobBuilder)) {
                    if (typeof worker == CONST_FUNCTION) {
                        config.external = false;
                        if (!config.useHelper) {
                            aFuncParts = /function\s*(\w*)(.*)/.exec(worker.toString());
                            aFuncParts[1] = aFuncParts[1] || "__user_func__"; // give unnamed functions a name.

                            // reconstruct function signature
                            strWorker = "function " + aFuncParts[1] + aFuncParts[2];
                            strWorker +=  worker.toString().substring(aFuncParts[0].length);

                            strWorker += ";onmessage=function(e){" +
                                ";var result = " + aFuncParts[1] + ".apply(null,e.data);" +
                                // lets just try to make it transferable
                                "postMessage(['"+ CONST_RETURN +"', result], !_async_ ? self._transferable_(result) : [])" +
                            "};";

                            // add async and transferable function to worker
                            strWorker += "var _async_ = "+ config.async +";self._transferable_=" + min_safe._transferable_.toString() + ";";

                            if (win.Blob) {
                                blob = new Blob([
                                    "self.complete=" + min_safe.complete.toString() + ";",
                                    "self.notify=" + min_safe.notify.toString() + ";",
                                    strWorker
                                ], {type: 'application/javascript'});
                            } else if (win.BlobBuilder || win.WebKitBlobBuilder || win.MozBlobBuilder || win.MSBlobBuilder) { // Backwards-compatibility
                                // WARNING: This isn't tested well because I can can't find any
                                //          other browser other than PhantomJS to test with
                                win.BlobBuilder = win.BlobBuilder || win.WebKitBlobBuilder || win.MozBlobBuilder || win.MSBlobBuilder;
                                blob = new BlobBuilder();
                                blob.append("self.complete=" + min_safe.complete.toString() + ";");
                                blob.append("self.notify=" + min_safe.notify.toString() + ";");
                                blob.append(strWorker);
                                blob = blob.getBlob();
                            }
                        }

                        try {
                            if (config.useHelper) {
                                aFuncParts = /function\s*(\w*)(.*)/.exec(worker.toString());
                                aFuncParts[1] = aFuncParts[1] || "a"; // give unnamed functions a name.

                                // reconstruct function signature
                                strWorker = "function " + aFuncParts[1] + aFuncParts[2];
                                strWorker +=  worker.toString().substring(aFuncParts[0].length);

                                // add async and transferable function to worker
                                //strWorker += ";var _async_ = "+ config.async +";" + transferable.toString();
                                retWorker = new WebworkerGenerator(strWorker, config);
                            } else {
                                retWorker = new WebworkerGenerator(URL.createObjectURL(blob), config);
                            }
                        } catch(e) {}

                    } else {
                        // assume it is a string, and hope for the best
                        config.external = true;
                        retWorker = new WebworkerGenerator(worker, config);

                    // } else {
                    // we can't do webworkers.
                    // FUTURE: Lets shim it. Maybe a timeout?
                    }
                }

                return retWorker;
            };

            function WebworkerGenerator(worker, config) {
                var noop = function() {};

                if (config.external || !config.useHelper) {
                    this.oWorker = new Worker(worker);
                } else {
                    this.oWorker = new Worker(WebworkerConfig.helperPath);
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
                    self = this,
                    messageData;

                this.oWorker.onmessage = function(oEvent) {
                    var strType,
                        oData = oEvent.data;

                    if (self.config.external && !self.config.async) {
                        oDeferred.resolve(oData);
                    } else {
                        strType = oEvent.data.shift();
                        oData = oEvent.data[0];

                        self.config.onMessage(oEvent);

                        // don't notify if we are complete or return
                        if (strType != CONST_COMPLETE && strType != CONST_RETURN) {
                            oDeferred.notify(oData);
                        }

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
                    messageData = Array.prototype.slice.call(arguments);
                } else {
                    //FUTURE: Use Array.slice(arguments) when available for V8 optimization
                    messageData = {
                        fn: self.strWorkerFunc,
                        args: Array.prototype.slice.call(arguments)
                    };
                }

                this.oWorker.postMessage(messageData, transferable(messageData, this));

                if (!self.config.external && !self.config.useHelper) {
                    oDeferred.promise.finally(function () {
                        // Every time run happens on a dynamic web worker it
                        // creates a new web worker to prevent a thread leak,
                        // a worker will only last once
                        self.terminate();
                    });
                }

                return oDeferred.promise;
            };

            WebworkerGenerator.prototype.stop = function() {
                this.oWorker.onerror(new Error('stopped'));
                this.terminate();
            };

            WebworkerGenerator.prototype.terminate = function() {
                this.oWorker.terminate();
            };

            function transferable(messageData, worker) {
                // FUTURE: CanvasProxy and MessagePort when browsers support it.
                var messageDataTransfers = [];

                // the worker_wrapper helper doesn't support transfers right now
                if (worker.config.transferOwnership && !worker.config.useHelper) {
                    angular.forEach(messageData, function(data) {
                        if (data instanceof ArrayBuffer) {
                            messageDataTransfers.push(data);
                        }
                    });
                }

                return messageDataTransfers;
            }
        }

        this.$get = ['$q', function($q) {
            return new Webworker($q);
        }];
    });


    return oWebworkerModule;
});
