module.exports = function (RED) {
  'use strict';
  var rsvp = require('rsvp');

  /**
   * Server side definition of tradfri node. Multiple options
   * - either is the device or group configured in the node
   * - incoming message defines the node to be managed. I.e. id is sent in message
   *
   * @author nidayand
   * @param {object} config HTML configuration data
   */
  function TradfriNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    // Configure the tradfri class as a global
    if (!RED.settings.functionGlobalContext.tradfri) {
      RED.settings.functionGlobalContext.tradfri = require('node-tradfri-argon').create({
        securityId: "2wsY1QSL65k3iD8i",
        hubIpAddress: "192.168.2.213",
        coapClientPath: "/home/user/libcoap/examples/coap-client"
      });
    }
    var tradfri = RED.settings.functionGlobalContext.tradfri;


    node.on('input', function (msg) {
      tradfri.getAll().then(res => {
        msg.payload = res;
        node.send(msg);
      });
    });
  }
  RED.nodes.registerType("tradfri-out", TradfriNode);

  function TradfriConfigNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

  }
  RED.nodes.registerType("tradfri-config", TradfriConfigNode);

}
