/*jslint node: true */
module.exports = function (RED) {
    "use strict";
    /*
        Defines the output node for a rule. Copied to a large extent from 66-mongodb.js
    */
    function TradfriOutNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        /* When a message is received */
        node.on("input", function (msg) {

            //node.send(nmsg);
        });

    }
    RED.nodes.registerType("tradfri-out", TradfriOutNode);
};
