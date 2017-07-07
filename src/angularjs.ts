import {NgWebWorker} from "./ng-webworker";
export import NgWebWorkerService = NgWebWorker.NgWebWorkerService;

// hack for us to use angular, but not require it since this is a library.
declare let angular: any;

angular.module('ngWebworker', [])
    .service('Webworker', NgWebWorkerService);
