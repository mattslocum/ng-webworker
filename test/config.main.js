var tests = Object.keys(window.__karma__.files).filter(function (strFile) {
    return /\.test\.js$/.test(strFile);
});


requirejs.config({
    // Karma serves files from '/base'
    baseUrl: '/base',
    paths: {
        "src/ng-webworker": "src/ng-webworker",
        "angular": "http://ajax.googleapis.com/ajax/libs/angularjs/1.5.2/angular",
        "angular-mocks": "http://ajax.googleapis.com/ajax/libs/angularjs/1.5.2/angular-mocks"
        // "angularjs": "src/angular.min",
        // "angular-mocks": "src/angular-mocks"
    },
    shim: {
        "angular-mocks": {
            deps: [
                "angular"
            ]
        },
        "src/ng-webworker": {
            deps: [
                "angular"
            ]
        },
        "src/ng-webworker.min": {
            deps: [
                "angular"
            ]
        }
    },

    // ask Require.js to load these files (all our tests)
    deps: tests,

    // start test run, once Require.js is done
    callback: window.__karma__.start
});

require(["angular", "angular-mocks"]);
