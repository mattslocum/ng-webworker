/**
 * @license ng-webworker v0.1
 * (c) 2014 Matt Slocum
 * License: MIT
 */

(function() {
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

    self.onmessage = function(oEvent) {
        var aFuncParts = /function\s*(\w+)(.*)/.exec(oEvent.data.fn);
        var aParts = oEvent.data.args;
        aParts.push(oEvent.data.fn);

        eval("self['" + aFuncParts[1] + "'] = " + oEvent.data.fn);

        postMessage({
            type:'return',
            data: self[aFuncParts[1]].apply(null, oEvent.data.args)
        });
    };

})();