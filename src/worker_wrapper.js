/**
 * ng-webworker - ng-webworker creates dynamic webworkers so angular apps can be multi-threaded.
 * @link https://github.com/mattslocum/ng-webworker
 * @license MIT
 */

(function() {
    //NOTE: transferable doesn't work for the worker_wrapper.
    function complete(mVal) {
        // _transferable_ is added to the worker
        postMessage(["complete", mVal])
    }
    function notify(mVal) {
        // _transferable_ is added to the worker
        postMessage(["notice", mVal])
    }

    self.onmessage = function(oEvent) {
        var aFuncParts = /function\s*(\w+)(.*)/.exec(oEvent.data.fn),
            aParts = oEvent.data.args,
            result;
        aParts.push(oEvent.data.fn);

        eval("self['" + aFuncParts[1] + "'] = " + oEvent.data.fn);

        postMessage([
            'return',
            self[aFuncParts[1]].apply(null, oEvent.data.args)
        ]);
    };

})();
