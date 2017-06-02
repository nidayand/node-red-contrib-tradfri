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
    this.name = config.name;
    this.dtype = config.dtype;
    this.id = config.id;

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
      // Check what type
      switch(typeof msg.payload){
        case "object":
          var id = msg.payload.id ? msg.payload.id : node.id;
          var type = msg.payload.type ? msg.payload.type : node.type;
          if (id === 0){
            node.error("msg.payload.id, device or group has not been defined");
            return;
          }
          if (!(type == "group") && !(type =="device")){
            node.error("msg.payload.type, device or group has not been defined");
            return;
          }
          if (!msg.payload.instruction){
            node.error("msg.payload.instruction object has not been defined");
            return;
          }
          if (type === "group"){
            node.hub.tradfri.setGroupState(id, msg.payload.instruction).then().catch( err => {node.error(err)});
          } else {
            node.hub.tradfri.setDeviceState(id, msg.payload.instruction).then().catch(err => {node.error(err)});
          }
          break;
        case "string":
          var action = msg.payload.trim().toLowerCase();

          if (node.dtype === "group")
            node.hub.tradfri.setGroupState(node.id,{state: action}).then().catch( err => {node.error(err)});
          else
            node.hub.tradfri.setDeviceState(node.id, {state: action}).then().catch(err => {node.error(err)});
          break;
      }
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
    var retError = function(err, res){
      res.writeHead(200, {
        'Content-Type': 'application/json'
      });
      res.write(JSON.stringify({ status: 'error'}));
      res.end();
    }

    tradfri.getGroups().then(groups => {
      groups.forEach(group => {
        group.type = 'group';
        d.push(group);
      });
      return tradfri.getDevices();

    }).catch(err =>{
      retError(err, res);
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
      console.log(22);
      retError(err, res);
    });
  });
}
