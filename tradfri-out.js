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
    this.hub = RED.nodes.getNode(config.hub);
    this.name = config.name

    var node = this;

    // Configure the tradfri class as a global
    if (node.hub.tradfri == null) {
      node.hub.tradfri = require('node-tradfri-argon').create({
        securityId: node.hub.sid,
        hubIpAddress: node.hub.hubip,
        coapClientPath: node.hub.coap
      });
      console.log("configured");

    }

    node.on('input', function (msg) {
      node.hub.tradfri.getAll().then(res => {
        msg.payload = res;
        node.send(msg);
      });
    });
  }
  RED.nodes.registerType("tradfri-out", TradfriNode);

  function TradfriConfigNode(config) {
    RED.nodes.createNode(this, config);
    this.name = config.name;
    this.hubip = config.hubip;
    this.sid = config.sid;
    this.coap = config.coap;
    this.tradfri = null; // Declare object to hold Tradfri class

  }
  RED.nodes.registerType("tradfri-config", TradfriConfigNode);


  RED.httpAdmin.get('/tradfri/controls', function (req, res) {
    /* Expecting to get the following params
      sid, hubip, coap
    */
    var tradfri = require('node-tradfri-argon').create({
      securityId: req.query.sid,
      hubIpAddress: req.query.hubip,
      coapClientPath: req.query.coap
    });

    var d = [];
    tradfri.getGroups().then(groups => {
      groups.forEach(group => {
        group.type = 'group';
        d.push(group);
      });

      return tradfri.getDevices();

    }).then((devices) => {
      devices.forEach(device => {
        device.type = 'device';
        d.push(device);
      });
      // Return array
      res.writeHead(200, {
        'Content-Type': 'application/json'
      });
      res.write(JSON.stringify({ items: d, status: 'ok'}));
      res.end();

    }).catch(err => {
      res.writeHead(200, {
        'Content-Type': 'application/json'
      });
      res.write(JSON.stringify({ status: 'error'}));
      res.end();
    });
  });
}
