onmessage = function (oEvent) {
    function timers(iTime, iNotices) {
        var iFinished = iNotices,
            iCalls = 0;
        while (iNotices--) {
            setTimeout(function() {
                postMessage(['notice', iCalls]);
                if (++iCalls == iFinished) {
                    postMessage(['complete', iCalls]);
                }
            }, iTime * (iNotices + 1));
        }
    }

    timers(oEvent.data[0], oEvent.data[1]);
};

