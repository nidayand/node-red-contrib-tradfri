module.exports = function (RED) {
  'use strict';
  var RSVP = require('rsvp');
  var ShortUniqueId = require('short-unique-id');

  var MAX_BRIGHTNESS = 254;

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
        coapClientPath: node.hub.coap,
        identity: node.hub.identity,
        preshared_key: node.hub.preshared_key
      });
    }

    node.on('input', function (msg) {
      if (msg.payload && !isNaN(parseInt(msg.payload))) {
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
        coapClientPath: node.hub.coap,
        identity: node.hub.identity,
        preshared_key: node.hub.preshared_key
      });
    }

    node.on('input', function (msg) {
      // Check what type
      switch(typeof msg.payload){
        case "object":
          var tradfri_id = parseInt(node.tradfri_id) != 0 ? node.tradfri_id : msg.payload.tradfri_id;
          var type = parseInt(node.tradfri_id) != 0 ? node.dtype :  msg.payload.type;

          if (tradfri_id == undefined || type == undefined){
            node.error("Set your node properties or make sure that tradfri_id and type is passed in the message payload");
            return;
          }

            // Create object
            var cinstruction = {};

            cinstruction.state = msg.payload.state ? msg.payload.state: undefined;

            //Set brightness = 0 if turnoff state
            if (msg.payload.state && msg.payload.state.toLowerCase() == "off"){
              cinstruction.brightness = 0;
            } else {
              cinstruction.brightness = msg.payload.brightness ? Math.min(msg.payload.brightness, MAX_BRIGHTNESS)  : undefined;
            }

            //Turn off if brightness = 0
            if (msg.payload.brightness && msg.payload.brightness == 0){
              cinstruction.state = "off";
            }
            cinstruction.color = msg.payload.color ? msg.payload.color : undefined;

            //Remove # if included
            if (cinstruction.color){
              cinstruction.color = cinstruction.color.replace('#', '').toLowerCase();
            }
            cinstruction.mired = msg.payload.mired ? msg.payload.mired : undefined;
            cinstruction.transitionTime = msg.payload.transitiontime ? msg.payload.transitiontime*10 : undefined; //Convert to expected lib input (*10)

            // Send the request
            if (type === "group"){
              // As color setting is not supported for groups, we need to get all devices that
              // belongs to a group and set it individually and finally the state of the group
              if (cinstruction.color){
                node.hub.tradfri.getGroup(tradfri_id).then(group => {
                  var calls = [];
                  group.devices.forEach(device =>{
                    calls.push(node.hub.tradfri.setDeviceState(device, cinstruction));
                  });
                  calls.push(node.hub.tradfri.setGroupState(tradfri_id, cinstruction));
                  RSVP.all(calls).then(() => {msg.payload=true; if (node.output) node.send(msg);}).catch( err => {node.error(err); msg.payload=false; if (node.output) node.send(msg);});
                });
              } else {
                node.hub.tradfri.setGroupState(tradfri_id, cinstruction).then(() => {msg.payload=true; if (node.output) node.send(msg);}).catch( err => {node.error(err); msg.payload=false; if (node.output) node.send(msg);});
              }

            } else {
              node.hub.tradfri.setDeviceState(tradfri_id, cinstruction).then(() => {msg.payload=true; if (node.output) node.send(msg);}).catch(err => {node.error(err); msg.payload=false; if (node.output) node.send(msg);});
            }


          break;
        case "string":
          var action = msg.payload.trim().toLowerCase();

          if (parseInt(node.tradfri_id) === 0){
            node.error("Set your node properties");
            return;
          }

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
    this.identity = config.identity;
    this.preshared_key = config.preshared_key;
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
      coapClientPath: req.query.coap,
      identity: req.query.identity,
      preshared_key: req.query.preshared_key
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

  RED.httpAdmin.get('/tradfri/register', function(req, res){
    //Generate UUID
    var uid = new ShortUniqueId().randomUUID(13);

    var tradfri = require('node-tradfri-argon').create({
      securityId: req.query.sid,
      hubIpAddress: req.query.hubip,
      coapClientPath: req.query.coap,
      identity: uid
    });
    var retError = function(err, res){
      res.writeHead(200, {
        'Content-Type': 'application/json'
      });
      res.write(JSON.stringify({ status: 'error'}));
      res.end();
    }

    tradfri.register().then(resp => {
      res.writeHead(200, {
        'Content-Type': 'application/json'
      });
      res.write(JSON.stringify({ identity: uid, preshared_key: resp.preshared_key, status: 'ok'}));
      res.end();
    }).catch( err => {retError(err, res);});
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
