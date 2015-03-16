#ng-webworker
demo and more instructions: [http://mattslocum.github.io/ng-webworker/](http://mattslocum.github.io/ng-webworker/)

###Installation for Testing

    npm install

###Run Tests

    grunt karma

###Build

    grunt uglify


#Using ng-webworker
## Basic Usage

###Include the module
```javascript
angular.module('demo', ['ngWebworker'])
    .controller('demoCtrl', function($scope, Webworker) {});
```

###Create a basic worker
```javascript
// function that will become a worker
function doubler(num) {
    // the return value becomes the resolve of the promise
    return num * 2;
}

var myWorker = Webworker.create(doubler);
```

###call the worker function
```javascript
myWorker.run($scope.value).then(function(result) {
    alert("Answer: " + result);
});
```



##Create an advanced worker
### Async (notification) promises
Lets say you want the notification support for webworkers for things like progress bars. There are times you do not want the return value to resolve the function. Maybe you are doing api requests or some other async tasks. An api of two functions is injected into the web worker. If an error is thrown, it will reject.
* complete - This will resolve the promise
* notify - Send a notification of data via the promise
```javascript
// function that will become a worker
function async(first, second) {
    // api to send a promise notification
    notify(first);
    // api to resolve the promise. Note: according to the $q spec, 
    // a promise cannot be used once it has been resolved or rejected.
    complete(second);
}

// mark this worker as one that supports async notifications
var myWorker = Webworker.create(async, {async: true });

// uses the native $q style notification: https://docs.angularjs.org/api/ng/service/$q
myWorker.run(1, 2).then(function(result) {
    // promise is resolved.
    alert('done');
}, null, function(progress) {
    // promise has a notification
    console.log(progress);
);
```

### Extra config
#### Global config
```javascript
angular.module('ngWebworker').config(function(WebworkerProvider) {
    WebworkerProvider.setHelperPath("/base/src/worker_wrapper.js");
    WebworkerProvider.setUseHelper(false);
    // transfer ownership doesn't work with the worker_wrapper helper
    WebworkerProvider.setTransferOwnership(true);
});
```

#### Instance Config
If you want callback style functions on top of the promise or as an alternative style, you can pass callbacks into the config block. These callbacks only work if async is true. When async is false it uses basic resolves when the function returns.
```javascript
var myWorker = Webworker.create(async, {
    async: true, // prevent the function return from resolving the promise
    useHelper: true/false, // defaults to false for most browsers. defaults to true for IE.
    onMessage: function(event) {}, // every event from the worker fires this when async:true
    onError: function(event) {}, // error event from the worker
    onReturn: function(data) {}, // return value from the function
    onComplete: function(data) {}, // data from complete/resolve function
    onNotice: function(data) {} // data from notice function
});
```

### IE workarounds
IE strikes again. The way ng-webworker can take a function and turn it into a webworker is by transforming your function into a Blob and executing that blob in a web worker like you would an independant file. Unfortunatly, IE treats blobs as cross domain. The solution is to have a worker shell file that is loaded as a separate file. Your function is strigified and then messaged over to the worker file and evaled to make it behave just like the blobs did.

