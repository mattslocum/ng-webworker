import {IQService} from "angular";

export module NgWebWorker {

    // hack for Webworker's postMessage
    declare function postMessage(data : any) : void;

    // hack for us to use angular, but not require it since this is a library.
    declare let angular: any;

    const CONST_FUNCTION : string = "function",
        CONST_RETURN : string = "return",
        CONST_COMPLETE : string = "complete",
        CONST_NOTICE : string = "notice";


    // add to Window to keep stuff happy.
    interface WindowExtras extends Window {
        webkitURL : any;

        BlobBuilder : any;
        MSBlobBuilder : any;
        WebKitBlobBuilder : any;
        MozBlobBuilder : any;
    }

    interface URLExtras extends URL {
        createObjectURL : any;
    }

    export interface NgWebWorkerConfig {
        fallback ?: boolean; // if useHelper and external are false and webworkers aren't possible then execute the function like a worker
        async ?: boolean;
        transferOwnership ?: boolean;

        onReturn ?: Function;
        onComplete ?: Function;
        onNotice ?: Function;
        onMessage ?: Function;
        onmessage ?: Function; // for webworker compatibility
        onError ?: Function;
        onerror ?: Function; // for webworker compatibility
    }


    // only use this function inside the webworker
    class WebWorkerHelper {
        public static complete(mVal : any) : void {
            postMessage(["complete", mVal])
        }

        public static notify(mVal : any) : void {
            postMessage(["notice", mVal])
        }

        public static _transferable_(messageData : any[]) : ArrayBuffer[] {
            let messageDataTransfers : any[] = [];

            // make sure we are an array
            if (Object.prototype.toString.apply(messageData) != '[object Array]') {
                messageData = [messageData];
            }

            messageData.forEach((data) => {
                // only ArrayBuffer is transferable
                if (data instanceof ArrayBuffer) {
                    messageDataTransfers.push(data);
                }
            });

            return messageDataTransfers;
        }

    }

    class NgWebworker {
        // external means that we are using a 3rd party webworker
        private _external : boolean = false;

        // helper means we are using our worker_wrapper so IE can handle dynamic webworkers
        private _useHelper : boolean = false; // gets set back to true for IE

        private _canDynamic : boolean;

        // our webworker instance
        private _worker : any;

        constructor(
            private $q : IQService,
            rawWorker : Function|string,
            private config : NgWebWorkerConfig = {}
        ) {
            let win : WindowExtras = <WindowExtras>window, // using win variable for minification
                MyURL : URLExtras = URL || win.webkitURL,
                BlobBuilder : MSBlobBuilder = win.BlobBuilder || win.MSBlobBuilder || win.WebKitBlobBuilder || win.MozBlobBuilder;

            this._canDynamic = !!(MyURL && MyURL.createObjectURL && (Blob || BlobBuilder));

            this.setupConfig();

            if (!Worker || (!this._canDynamic && typeof rawWorker !== "string")) {
                // TODO: should we throw? This browser won't work!
                return null;
            }

            this.makeWorker(this.buildWorkerBlob(rawWorker));
        }

        private setupConfig() : void {
            let noop : Function = function() {};

            // support webworker lowercase style
            if (this.config.onmessage) {
                this.config.onMessage = this.config.onmessage;
                this.config.onError = this.config.onerror;
            }

            this.config = angular.extend({
                //setup events so they will always be there
                onMessage: noop,
                onError: noop,
                onReturn: noop,
                onComplete: noop,
                onNotice: noop,

                async: false,
                helperPath: "worker_wrapper.js",
                transferOwnership: true
            }, this.config);

            // stupid IE thinks Blob Webworkers violate same-origin
            // stupid Edge thinks it's not IE
            if (navigator.userAgent.indexOf('MSIE') !== -1 ||
                navigator.userAgent.indexOf('Edge') !== -1 ||
                navigator.appVersion.indexOf('Trident/') > 0
            ) {
                this._useHelper = true;
            }
        }

        private buildWorkerBlob(rawWorker : string|Function) : string {
            let worker : string;

            if (typeof rawWorker === CONST_FUNCTION) {
                this._external = false;

                // TODO: use destructuring instead of indexes
                let funcParts : string[] = /function\s*(\w*)(.*)/.exec(rawWorker.toString());
                funcParts[1] = funcParts[1] || "a"; // give unnamed anonymous functions a name.

                // reconstruct function signature
                worker = "function " + funcParts[1] + funcParts[2];
                worker += rawWorker.toString().substring(funcParts[0].length);


                if (this._useHelper) {
                    // TODO: support helpers
                } else {
                    // setup message and lets just try to make it transferable
                    worker +=
`;onmessage=function(e){
    var result = ${funcParts[1]}.apply(null,e.data);
    postMessage(['${CONST_RETURN}', result])
};`;
                    worker += "complete=" + WebWorkerHelper.complete.toString() + ";";
                    worker += "notify=" + WebWorkerHelper.notify.toString() + ";";

                    let blob : Blob;

                    if (Blob) {
                        blob = new Blob([worker], {type: 'application/javascript'});
                    }
                    // TODO: Else?

                    try {
                        // TODO: use URL.revokeObjectURL to prevent memory leaks
                        worker = URL.createObjectURL(blob);
                    } catch (e) {}
                }

            } else if (typeof rawWorker === "string") {
                // assume it is a string, and hope for the best
                this._external = true;
                worker = <string>rawWorker;

                // } else {
                // we can't do webworkers.
                // FUTURE: Lets shim it. Maybe a timeout?
            }

            return worker;
        }

        private makeWorker(worker : string) : void {
            this._worker = new Worker(worker);
        }

        //TODO: save copy of promise/worker pair so we can terminate
        public run(...args : any[]) {
            let deferred = this.$q.defer(),
                messageData;

            this._worker.onmessage = (event : MessageEvent) => {
                let strType : string,
                    data : any = event.data;

                if (this._external && !this.config.async) {
                    deferred.resolve(data);
                } else {
                    strType = event.data.shift();
                    data = event.data[0];

                    this.config.onMessage(event);

                    // don't notify if we are complete or return
                    if (strType !== CONST_COMPLETE && strType !== CONST_RETURN) {
                        deferred.notify(data);
                    }

                    if (strType === CONST_RETURN) {
                        if (!this.config.async) {
                            deferred.resolve(data);
                        }
                        this.config.onReturn(data);
                    } else if (strType === CONST_COMPLETE) {
                        deferred.resolve(data);
                        this.config.onComplete(data);
                    } else if (strType === CONST_NOTICE) {
                        this.config.onNotice(data);
                    }
                }
            };

            this._worker.onerror = function(oError : ErrorEvent) : void {
                deferred.reject(oError);
            };

            if (this._external || !this._useHelper) {
                //FUTURE: Use Array.slice(arguments) when available for V8 optimization
                messageData = args;
            } else {
                //FUTURE: Use Array.slice(arguments) when available for V8 optimization
                messageData = {
                    // TODO: FIX THIS
                    fn: '', //this._strWorkerFunc,
                    args: args
                };
            }

            this._worker.postMessage(messageData, this.doTransferableMessage(messageData));

            if (!this._external && !this._useHelper) {
                deferred.promise.finally(() => {
                    // Every time run happens on a dynamic web worker it
                    // creates a new web worker to prevent a thread leak,
                    // a worker will only last once
                    this.terminate();
                });
            }

            return deferred.promise;
        }

        public stop() : void {
            this._worker.onerror(new Error('stopped'));
            this.terminate();
        };

        public terminate() : void {
            this._worker.terminate();
        }

        private doTransferableMessage(messageData : any) {
            // FUTURE: CanvasProxy and MessagePort when browsers support it.
            let messageDataTransfers : any[] = [];

            // the worker_wrapper helper doesn't support transfers right now
            if (this.config.transferOwnership && !this._useHelper) {
                angular.forEach(messageData, (data : ArrayBuffer) => {
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

        constructor(private $q : IQService) {}

        public create(
            rawWorker : Function|string,
            config : NgWebWorkerConfig = {}
        ) : NgWebworker {
            return new NgWebworker(this.$q, rawWorker, config);
        }
    }

    angular.module('ngWebworker', [])
        .service('Webworker', NgWebWorkerService);

}
