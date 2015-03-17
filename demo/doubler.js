self.onmessage = function (oEvent) {
    self.postMessage(oEvent.data * 2);
};
