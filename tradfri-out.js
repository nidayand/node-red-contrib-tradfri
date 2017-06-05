module.exports = function (RED) {
  'use strict';

  function TradfriUtilNode(config) {
    RED.nodes.createNode(this, config);
    this.hub = RED.nodes.getNode(config.hub);
    this.name = config.name;

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
      if (msg.payload && !isNaN(parseInt(msg.payload))){
        node.hub.tradfri.getDevice(msg.payload).then(device => {
          msg.payload = device;
          node.send(msg);
        }).catch( err => {
          node.hub.tradfri.getGroup(msg.payload).then(group => {
            msg.payload = group;
            node.send(msg);
          }).catch( err => {
            node.error("Could not find device or group with the specified id or the IKEA Hub did not respond");
            return null;
          });
        });
      } else {
        node.hub.tradfri.getAll().then(all => {
          msg.payload = all;
          node.send(msg);
        }).catch(err => {
          node.error("IKEA Hub did not respond. Review the configuration or try again");
        });
      }
    });
  }
  RED.nodes.registerType("tradfri-get", TradfriUtilNode);


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
    this.tradfri_id = config.tradfri_id;
    this.output = config.output;

    var node = this;

    // Configure the tradfri class as a global
    if (node.hub.tradfri == null) {
      node.hub.tradfri = require('node-tradfri-argon').create({
        securityId: node.hub.sid,
        hubIpAddress: node.hub.hubip,
        coapClientPath: node.hub.coap
      });
    }

    node.on('input', function (msg) {
      // Check what type
      switch(typeof msg.payload){
        case "object":
          var tradfri_id = msg.payload.tradfri_id ? msg.payload.tradfri_id : node.tradfri_id;
          var type = msg.payload.type ? msg.payload.type : node.type;
          if (tradfri_id === 0){
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
            node.hub.tradfri.setGroupState(tradfri_id, msg.payload.instruction).then(() => {msg.payload=true; if (node.output) node.send(msg);}).catch( err => {node.error(err); msg.payload=false; if (node.output) node.send(msg);});
          } else {
            node.hub.tradfri.setDeviceState(tradfri_id, msg.payload.instruction).then(() => {msg.payload=true; if (node.output) node.send(msg);}).catch(err => {node.error(err); msg.payload=false; if (node.output) node.send(msg);});
          }
          break;
        case "string":
          var action = msg.payload.trim().toLowerCase();

          if (node.dtype === "group")
            node.hub.tradfri.setGroupState(node.tradfri_id,{state: action}).then(() => {msg.payload=true; if (node.output) node.send(msg);}).catch( err => {node.error(err); msg.payload=false; if (node.output) node.send(msg);});
          else
            node.hub.tradfri.setDeviceState(node.tradfri_id, {state: action}).then(() => {msg.payload=true; if (node.output) node.send(msg);}).catch(err => {node.error(err); msg.payload=false; if (node.output) node.send(msg);});
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

  RED.httpAdmin.get('/tradfri/libs', function (req, res) {
    //Get path to module
    var pathIndex = require.resolve("node-tradfri-argon");
    var path = require('path').dirname(pathIndex)+"/lib";
    var fs = require('fs');
    var r = [];
    fs.readdirSync(path).forEach(file => {
      if (file.indexOf('coap-client-')!=-1){
        r.push({file:file, path:(path+'/'+file)});
      }
    })
    // Return array
    res.writeHead(200, {
      'Content-Type': 'application/json'
    });
    res.write(JSON.stringify(r));
    res.end();
  });
}
