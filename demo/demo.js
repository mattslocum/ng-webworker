var app = angular.module('demo', ['ngWebworker']);

app.config(function(WebworkerProvider) {
    WebworkerProvider.setHelperPath("../bower_components/ng-webworker/src/worker_wrapper.js");
    //WebworkerProvider.setUseHelper(true);
});


app.controller('demoCtrl', function($scope, $q, Webworker) {
    var defaultImage = "grays_hike.jpg";
    $scope.value = 5;
    $scope.image = defaultImage;
    $scope.numList = "1,2,3,4,5";

    $scope.pureJSWorker = function() {
        var myWorker = new Worker("doubler.js");

        myWorker.onmessage = function (result) {
            alert("Answer: " + result.data);
        };

        myWorker.postMessage($scope.value); // start the worker.
    };

    $scope.functionWorker = function() {
        function doubler(num) {
            return num * 2;
        }

        var myWorker = Webworker.create(doubler);

        myWorker.run($scope.value).then(function(result) {
            alert("Answer: " + result);
        });
    };

    $scope.externalWorker = function() {
        var myWorker = Webworker.create("doubler.js");

        myWorker.run($scope.value).then(function(result) {
            alert("Answer: " + result);
        });
    };

    $scope.asyncWorker = function() {
        function async(iTime, iNotices) {
            var iFinished = iNotices,
                iCalls = 0;
            while (iNotices--) {
                setTimeout(function() {
                    notify(++iCalls);
                    if (iCalls == iFinished) {
                        complete(iCalls);
                    }
                }, iTime * (iNotices + 1));
            }
        }

        var myWorker = Webworker.create(async, {async: true });

        $scope.asyncProgress = 0;
        $scope.asyncDone = false;

        myWorker.run(500, $scope.value).then(function(result) {
            $scope.asyncDone = true;
        }, null, function(progress) {
            $scope.asyncProgress = progress / ($scope.value) * 100;
        });
    };

    var imageWorker;
    $scope.blurImage = function() {
        var canvas = document.createElement('canvas'),
            context = canvas.getContext('2d'),
            dStart = new Date();

        imageWorker = Webworker.create(gaussianBlur);

        $scope.imageProgress = 0;
        $scope.imageDone = false;

        getImage(canvas, context).then(function(imageData) {
            imageWorker.run(imageData, $scope.value / 5).then(function(result) {
                context.putImageData(result, 0, 0);
                $scope.image = canvas.toDataURL();
                $scope.imageProgress = 100;
                $scope.imageDone = true;
                imageWorker = null;
                $scope.iImageTime = ((new Date()) - dStart) / 1000;
            }, null, function(progress) {
                $scope.imageProgress = progress;
            }).catch(function(oError) {
                imageWorker = null;
                alert("stopped");
            });
        });
    };

    $scope.resetImage = function() {
        $scope.image = defaultImage;
    };

    $scope.stopImage = function() {
        if (imageWorker) {
            imageWorker.stop();
        }
    };

    function getImage(canvas, context) {
        var img = new Image(),
            oDeffered = $q.defer();

        img.onload = function(){
            canvas.height = img.height;
            canvas.width = img.width;
            context.drawImage(img, 0, 0, img.width, img.height);
            oDeffered.resolve(context.getImageData(0, 0, img.width, img.height));
        };
        img.src = defaultImage;

        return oDeffered.promise;
    }


    $scope.requireDemo = function() {
        var requireWorker = Webworker.create(requireSum, {async: true});

        requireWorker.run($scope.numList.split(',')).then(function(result) {
            alert(result);
        });
    };

    function requireSum(array) {
        importScripts("https://cdnjs.cloudflare.com/ajax/libs/require.js/2.1.20/require.min.js");

        require(['https://cdnjs.cloudflare.com/ajax/libs/lodash.js/3.10.0/lodash.min.js'], function(_) {
            return complete(_.sum(array));
        });
    }

});





// I wrote this function a long time ago, so don't hate me.
function gaussianBlur(imageData, radius) {
    //http://haishibai.blogspot.com/2009/09/image-processing-c-tutorial-4-gaussian.html
    //http://dev.theomader.com/gaussian-kernel-calculator/
    function gaussianKernel(deviation, maxSize) {
        function roundTo(num, decimals) {
            var shift = Math.pow(10, decimals);
            return Math.round(num * shift) / shift;
        }

        var ret = [],
            d1 = [],
            temp = [],
            i = 0, j;
        maxSize = maxSize || Infinity;

        while ((!d1.length || d1[0]) && i - 1 < (maxSize + 1) / 2) {
            d1.unshift(
                roundTo(1 / (Math.sqrt(2 * Math.PI) * deviation) * Math.exp(-(i) * (i) / (2 * deviation * deviation)), 6)
            );
            i++;
        }
        d1.shift(); // we don't need the 0

        d1 = d1.concat( d1.slice(0, -1).reverse() );

        for (i = 0; i < d1.length; i++) {
            temp = [];
            for (j = 0; j < d1.length; j++) {
                temp.push(d1[i] * d1[j]);
            }
            ret.push(temp);
        }

        return ret;
    }

    function constrain(value, min, max) {
        return Math.max(Math.min(value, max), min);
    }

    var matrix = gaussianKernel(radius),
        pixels = imageData.data,
        result = [],
        offset = Math.floor(matrix.length / 2),
        percent = 0,
        pixelsLength = pixels.length,
        sum = 0,
        loc, temp, x, y, i, t;

//    matrix.forEach(function(row) {
//        row.forEach(function(weight) {
//            sum += weight;
//        });
//    });

    for (i = 0; i < pixelsLength; i++) {
        t = 0;
        // 4 = red + blue + green + alpha
//        for (y = offset * -4; y <= offset * 4; y += 4) {
//            for (x = offset * -4; x <= offset * 4; x += 4) {
//                loc = i + x;
//                debugger;
//                if (Math.floor(i/5) != Math.floor(loc/5))
//                    loc = i; //loc moved rows, put it back.
//                temp = loc;
//                loc += y * imageData.width;
//                if (loc < 0 || loc > pixels.length-1)
//                    loc = temp;
//                t += pixels[loc] * matrix[x/4+offset][y/4+offset];
//            }
//        }
        var minX = Math.floor(i / (imageData.width * 4)) * imageData.width * 4;
        var maxX = minX + (imageData.width - 1) * 4;
        var maxY = pixelsLength - imageData.width * 4;

        for (y = 0; y < matrix.length; y++) {
            for (x = 0; x < matrix[y].length; x++) {
                loc = constrain(
                    i + (x - offset) * 4,
                    minX,
                    maxX
                );
                loc = constrain(
                    loc + (y - offset) * imageData.width * 4,
                    loc % (imageData.width * 4),
                    maxY + (x - offset) * 4
                );
//                if (loc < 0 || loc >= pixelsLength) {
//                    debugger;
//                }
                t += pixels[loc] * matrix[y][x];
            }
        }

        result[i] = Math.round(t);
        if (i % 40 == 0 && i / pixelsLength * 100 >= percent + 1) {
            percent = Math.floor(i / pixelsLength * 100);
            notify(percent);
        }
    }

//    for (i = 0; i < pixels.length; i++) {
//        if (i % 4 == 3) continue; // skip alpha
//
//    }

    imageData.data.set(result);
    return imageData;
}
