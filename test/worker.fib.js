onmessage = function (oEvent) {
    function fib(nth) {
        var previous = 1, current = 1, temp, i;

        for (i = 3; i <= nth; i++) {
            temp = current;
            current = current + previous;
            previous = temp;
        }
        nth = current;

        return nth;
    }

    postMessage(fib(oEvent.data[0]));
};
