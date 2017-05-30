module.exports = function (RED) {
  'use strict';
  var rsvp = require('rsvp');

  if (!RED.settings.functionGlobalContext.tradfri) {
    RED.settings.functionGlobalContext.tradfri = require('node-tradfri-argon').create({
      securityId: "2wsY1QSL65k3iD8i",
      hubIpAddress: "192.168.2.213",
      coapClientPath: "/home/user/libcoap/examples/coap-client"
    });
  }
  var tradfri = RED.settings.functionGlobalContext.tradfri;

  function TradfriNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    node.on('input', function (msg) {
      tradfri.getAll().then(res => {
        msg.payload = res;
        node.send(msg);
      });
    });
  }
  RED.nodes.registerType("tradfri-out", TradfriNode);
}
