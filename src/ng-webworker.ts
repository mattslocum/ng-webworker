
export module NgWebWorker {

    // hack for Webworker's postMessage
    declare function postMessage(data : any, transfer ?: ArrayBuffer[]) : void;
    // hack to keep WebWorkerHelper.complete happy
    declare let _transferable_: Function;

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
        async ?: boolean;
        helperPath ?: string;
        transferOwnership ?: boolean;

        onReturn ?: Function;
        onComplete ?: Function;
        onNotice ?: Function;
        onMessage ?: Function;
        onmessage ?: Function; // for webworker compatibility
        onError ?: Function;
        onerror ?: Function; // for webworker compatibility
    }

    // exporting this so it can be overridden externally.
    // This is only used during instantiation.
    export let helperPath : string = "worker_wrapper.js";

    // only use this function inside the webworker
    class WebWorkerHelper {
        public static complete(mVal : any) : void {
            // _transferable_ is added to the worker
            postMessage(["complete", mVal], _transferable_(mVal))
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

    export class NgWebworker {
        // We are using a 3rd party webworker maintained by someone else
        private _3rdParty : boolean = false;

        // helper means we are using our worker_wrapper so IE can handle dynamic webworkers
        private _useHelper : boolean = false; // gets set back to true for IE

        private _canDynamic : boolean;

        // our webworker instance
        private _worker : any;
        private _strWorkerObjUrl : string;
        private _helperFunc : string;

        constructor(
            rawWorker : Function|string,
            private config : NgWebWorkerConfig = {}
        ) {
            this.setupConfig(rawWorker);

            if (!Worker || (!this._canDynamic && typeof rawWorker !== "string")) {
                // TODO: should we throw? This browser won't work!
                // FUTURE: Maybe a timeout? Maybe a space warp continuum?
                return null;
            }

            this.makeWorker(this.buildWorkerBlob(rawWorker));
        }

        private setupConfig(rawWorker : Function|string) : void {
            let noop : Function = function() {};
            let win : WindowExtras = <WindowExtras>window, // using win variable for minification
                MyURL : URLExtras = URL || win.webkitURL,
                BlobBuilder : MSBlobBuilder = win.BlobBuilder || win.MSBlobBuilder || win.WebKitBlobBuilder || win.MozBlobBuilder;

            this._canDynamic = !!(MyURL && MyURL.createObjectURL && (Blob || BlobBuilder));
            this._3rdParty = typeof rawWorker !== CONST_FUNCTION;

            // stupid IE thinks Blob Webworkers violate same-origin
            // stupid Edge thinks it's not IE
            if (navigator.userAgent.indexOf('MSIE') !== -1 ||
                navigator.userAgent.indexOf('Edge') !== -1 ||
                navigator.appVersion.indexOf('Trident/') > 0
            ) {
                this._useHelper = !this._3rdParty;
            }

            // support webworker lowercase style
            if (this.config.onmessage) {
                this.config.onMessage = this.config.onmessage;
                this.config.onError = this.config.onerror;
            }

            //setup events so they will always be there
            this.config.onMessage =   this.config.onMessage || noop;
            this.config.onError =     this.config.onError || noop;
            this.config.onReturn =    this.config.onReturn || noop;
            this.config.onComplete =  this.config.onComplete || noop;
            this.config.onNotice =    this.config.onNotice || noop;

            this.config.async =       this.config.async || false; // if set, don't resolve promise on function complete.
            this.config.helperPath =  this.config.helperPath || helperPath;
            this.config.transferOwnership = this.config.transferOwnership || true;
        }

        private buildWorkerBlob(rawWorker : string|Function) : string {
            let worker : string;

            if (typeof rawWorker === CONST_FUNCTION) {

                let funcParts : string[] = /function\s*(\w*)/.exec(rawWorker.toString());
                funcParts[1] = funcParts[1] || "a"; // give unnamed anonymous functions a name.

                // reconstruct function signature
                worker = "function " + funcParts[1];
                worker += rawWorker.toString().substring(funcParts[0].length);


                // our helper doesn't need any event handlers because it already has them.
                if (!this._useHelper) {
                    // setup message and try to make it transferable
                    worker +=
`;onmessage=function(e){
    var result = ${funcParts[1]}.apply(null,e.data);
    postMessage(['${CONST_RETURN}', result], _async_ ? [] : _transferable_(result))
};`;
                    worker += `var _async_ = ${this.config.async};`;
                    worker += "complete=" + WebWorkerHelper.complete.toString() + ";";
                    worker += "notify=" + WebWorkerHelper.notify.toString() + ";";
                    worker += "_transferable_=" + WebWorkerHelper._transferable_.toString() + ";";

                    let blob : Blob;

                    if (Blob) {
                        blob = new Blob([worker], {type: 'application/javascript'});
                    }
                    // TODO: Else?

                    // don't catch. Lets make the implementer catch. We shouldn't even get here.
                    // try {
                    worker = URL.createObjectURL(blob);
                    this._strWorkerObjUrl = worker;
                    // } catch (e) {}
                }

            } else if (typeof rawWorker === "string") {
                this._3rdParty = true;
                worker = <string>rawWorker;
            }

            return worker;
        }

        private makeWorker(worker : string) : void {
            if (this._3rdParty || !this._useHelper) {
                this._worker = new Worker(worker);
            } else {
                this._worker = new Worker(this.config.helperPath);
                this._helperFunc = worker;
            }
        }

        //TODO: save copy of promise/worker pair so we can terminate.
        //      aka: make this re-runnable
        public run(...args : any[]) : Promise<any> {
            let workerPromise : Promise<any> = new Promise((resolve, reject) => {
                let messageData : any;

                this.bindEvents(resolve, reject);

                if (this._3rdParty || !this._useHelper) {
                    messageData = args;
                } else {
                    messageData = {
                        // send the stringified function to the helper for it to reconstruct.
                        fn: this._helperFunc,
                        args: args
                    };
                }

                this._worker.postMessage(messageData, this.doTransferableMessage(messageData));
            });

            if (this._strWorkerObjUrl) {
                // Every time run happens on a dynamic web worker it
                // creates a new web worker to prevent a thread leak,
                // a worker will only last once
                workerPromise.then(this.terminate.bind(this));
                workerPromise.catch(this.terminate.bind(this));
            }

            return workerPromise;
        }

        public stop() : void {
            this._worker.onerror(new Error('stopped'));
            this.terminate();
        };

        public terminate() : void {
            this._worker.terminate();
            if (this._strWorkerObjUrl) {
                URL.revokeObjectURL(this._strWorkerObjUrl);
                this._strWorkerObjUrl = null;
            }
        }

        private doTransferableMessage(messageData : any[]) {
            // FUTURE: CanvasProxy and MessagePort when browsers support it.
            let messageDataTransfers : any[] = [];

            // the worker_wrapper helper doesn't support transfers right now
            if (this.config.transferOwnership && !this._useHelper && Array.isArray(messageData)) {
                messageData.forEach((data : ArrayBuffer) => {
                    if (data instanceof ArrayBuffer) {
                        messageDataTransfers.push(data);
                    }
                });
            }

            return messageDataTransfers;
        }

        private bindEvents(resolve : any, reject : any) : void {
            this._worker.onmessage = (event : MessageEvent) => {
                let strType : string,
                    data : any = event.data;

                if (this._3rdParty && !this.config.async) {
                    resolve(data);
                } else {
                    strType = event.data.shift();
                    data = event.data[0];

                    this.config.onMessage(event);

                    if (strType === CONST_RETURN) {
                        if (!this.config.async) {
                            resolve(data);
                        }
                        this.config.onReturn(data);
                    } else if (strType === CONST_COMPLETE) {
                        resolve(data);
                        this.config.onComplete(data);
                    } else if (strType === CONST_NOTICE) {
                        this.config.onNotice(data);
                    }
                }
            };

            this._worker.onerror = (error : ErrorEvent) => {
                reject(error);
            };
        }
    }

    export class NgWebWorkerService {
        public create(
            rawWorker : Function|string,
            config : NgWebWorkerConfig = {}
        ) : NgWebworker {
            return new NgWebworker(rawWorker, config);
        }
    }

}
