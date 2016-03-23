/**
 * ng-webworker - ng-webworker creates dynamic webworkers so angular apps can be multi-threaded.
 * @version v0.2.3
 * @link https://github.com/mattslocum/ng-webworker
 * @license MIT
 */
!function(){function complete(t){postMessage(["complete",t])}function notify(t){postMessage(["notice",t])}self.onmessage=function(oEvent){var aFuncParts=/function\s*(\w+)(.*)/.exec(oEvent.data.fn),aParts=oEvent.data.args,result;aParts.push(oEvent.data.fn),eval("self['"+aFuncParts[1]+"'] = "+oEvent.data.fn),postMessage(["return",self[aFuncParts[1]].apply(null,oEvent.data.args)])}}();