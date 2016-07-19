
export module NgWebWorker {

    // hack for Webworker's postMessage
    declare function postMessage(data : any) : void;

    export interface NgWebWorkerConfig {
        useHelper ?: boolean;
        fallback ?: boolean; // if useHelper and external are false and webworkers aren't possible then execute the function like a worker
        async ?: boolean;
    }


    // only use this function inside the webworker
    export class WebWorkerHelper {
        public static complete(mVal) {
            postMessage(["complete", mVal])
        }

        public static notify(mVal) {
            postMessage(["notice", mVal])
        }
    }

    class NgWebworker {
        // external means that we are using a 3rd party webworker
        private external : boolean = false;

        private worker;

        constructor(private $q : ng.IQService, rawWorker : Function|string, private config : NgWebWorkerConfig = {}) {
            let win : Window = window, // using win variable for minification
                MyURL : URL = URL || win['webkitURL'],
                BlobBuilder : MSBlobBuilder = win['BlobBuilder'] || win['MSBlobBuilder'] || win['WebKitBlobBuilder'] || win['MozBlobBuilder'];

            this.setupConfig();

            if (!Worker || !MyURL || !MyURL.createObjectURL || !(Blob || BlobBuilder)) {
                return null;
            }

            this.makeWorker(this.buildWorkerBlob(rawWorker));
            return;

            if (typeof rawWorker == "function") {
                config.external = false;
                if (!config.useHelper) {
                    aFuncParts = /function\s*(\w*)(.*)/.exec(rawWorker.toString());
                    aFuncParts[1] = aFuncParts[1] || "a"; // give unnamed functions a name.

                    // reconstruct function signature
                    strWorker = "function " + aFuncParts[1] + aFuncParts[2];
                    strWorker +=  rawWorker.toString().substring(aFuncParts[0].length);

                    strWorker += ";onmessage=function(e){" +
                        ";var result = " + aFuncParts[1] + ".apply(null,e.data);" +
                        // lets just try to make it transferable
                        "postMessage(['"+ CONST_RETURN +"', result], !_async_ ? _transferable_(result) : [])" +
                        "};";

                    // add async and transferable function to worker
                    strWorker += "var _async_ = "+ config.async +";" + _transferable_.toString();

                    if (win.Blob) {
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

                this.webworker = this.buildWorkerBody(rawWorker);

                try {
                } catch(e) {}

            } else {
                // assume it is a string, and hope for the best
                config.external = true;
                this.webworker = new WebworkerGenerator(rawWorker, config);

                // } else {
                // we can't do webworkers.
                // FUTURE: Lets shim it. Maybe a timeout?
            }
        }

        private setupConfig() {
            this.config = angular.extend({
                async: false,
                helperPath: "worker_wrapper.js",
                useHelper: false, // gets set back to true for IE
                transferOwnership: true
            }, this.config);

            // stupid IE thinks Blob Webworkers violate same-origin
            // stupid Edge thinks it's not IE
            if (navigator.userAgent.indexOf('MSIE') !== -1 ||
                navigator.userAgent.indexOf('Edge') !== -1 ||
                navigator.appVersion.indexOf('Trident/') > 0) {
                this.config.useHelper = true;
            }
        }

        private buildWorkerBlob(rawWorker : string|Function) : string {
            let worker : string;
            let win : Window = window;

            if (typeof rawWorker == "function") {
                this.external = false;

                let funcParts : string[] = /function\s*(\w*)(.*)/.exec(rawWorker.toString());
                funcParts[1] = funcParts[1] || "a"; // give unnamed anonymous functions a name.

                // reconstruct function signature
                worker = "function " + funcParts[1] + funcParts[2];
                worker += rawWorker.toString().substring(funcParts[0].length);


                if (!this.config.useHelper) {
                    // setup message and lets just try to make it transferable
                    worker += `;onmessage=function(e){
                        debugger;
                        var result = ${funcParts[1]}.apply(null,e.data);
                        postMessage(['return', result])
                        };`;

                    let blob : Blob | MSBlobBuilder;
                    let BlobBuilder : MSBlobBuilder = win['BlobBuilder'] || win['MSBlobBuilder'] || win['WebKitBlobBuilder'] || win['MozBlobBuilder'];

                    if (Blob) {
                        blob = new Blob([WebWorkerHelper.complete, WebWorkerHelper.notify, worker], {type: 'application/javascript'});
                    } else if (BlobBuilder) { // Backwards-compatibility
                        // WARNING: This isn't tested well because I can can't find any
                        //          other browser other than PhantomJS to test with
                        blob = <MSBlobBuilder>(new BlobBuilder());
                        blob.append(WebWorkerHelper.complete);
                        blob.append(WebWorkerHelper.notify);
                        blob.append(worker);
                        blob = blob.getBlob();
                    }

                    try {
                        worker = URL.createObjectURL(blob);
                    } catch (e) {}
                } else {

                }

            } else {
                // assume it is a string, and hope for the best
                this.external = true;
                worker = <string>rawWorker;

                // } else {
                // we can't do webworkers.
                // FUTURE: Lets shim it. Maybe a timeout?
            }

            return worker;
        }

        private makeWorker(worker : string) {
            console.log(worker);
            this.worker = new Worker(worker);

            return;
            if (this.external || !this.config.useHelper) {
                this.worker = new Worker(worker);
            } else {
                this.worker = new Worker(this.config.helperPath);
                this.strWorkerFunc = worker;
            }
        }

        //TODO: save copy of promise/worker pair so we can terminate
        public run(...args) {
            var oDeferred = this.$q.defer(),
                self = this,
                messageData;

            this.worker.onmessage = function(oEvent) {
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

            this.worker.onerror = function(oError) {
                oDeferred.reject(oError);
            };

            if (self.config.external || !self.config.useHelper) {
                //FUTURE: Use Array.slice(arguments) when available for V8 optimization
                messageData = args;
            } else {
                //FUTURE: Use Array.slice(arguments) when available for V8 optimization
                messageData = {
                    fn: self.strWorkerFunc,
                    args: args
                };
            }

            this.worker.postMessage(messageData, this.doTransferableMessage(messageData));

            if (!this.config.external && !this.config.useHelper) {
                oDeferred.promise.finally(function () {
                    // Every time run happens on a dynamic web worker it
                    // creates a new web worker to prevent a thread leak,
                    // a worker will only last once
                    this.terminate();
                });
            }

            return oDeferred.promise;
        }


        doTransferableMessage(messageData) {
            // FUTURE: CanvasProxy and MessagePort when browsers support it.
            var messageDataTransfers = [];

            // the worker_wrapper helper doesn't support transfers right now
            if (this.config.transferOwnership && !this.config.useHelper) {
                angular.forEach(messageData, function(data) {
                    if (data instanceof ArrayBuffer) {
                        messageDataTransfers.push(data);
                    }
                });
            }

            return messageDataTransfers;
        }

    }

    export class NgWebWorkerService {
        static $inject = [ '$q' ];

        constructor(private $q) {}

        public create(rawWorker : Function|string, config : NgWebWorkerConfig = {}) {
            return new NgWebworker(this.$q, rawWorker, config);
        }
    }

    angular.module('ngWebworker', [])
        .service('Webworker', NgWebWorkerService);

}
