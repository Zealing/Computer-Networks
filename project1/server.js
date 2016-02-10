#!/usr/bin/node
'use strict';

var dgram = require('dgram');
var util = require('util');
var readline = require('readline');

var SERVER_PORT = 33333;

var server = dgram.createSocket('udp4');
var serverProbe = dgram.createSocket('udp4').bind(9999);

var serviceIP;
var clientPort;

var seqNum = 0;

var timer = null;
var setTimer = false;

// initialize header and const commands
const magic = new Buffer(2);
magic.writeUInt16BE(0xC461, 0);

const REGISTER = new Buffer(1);
REGISTER.writeUInt8(0x01, 0);

const REGISTERed = new Buffer(1);
REGISTERed.writeUInt8(0x02, 0);

const FETCH = new Buffer(1);
FETCH.writeUInt8(0x03, 0);

const FETCHres = new Buffer(1);
FETCHres.writeUInt8(0x04, 0);

const UNREGISTER = new Buffer(1);
UNREGISTER.writeUInt8(0x05, 0);

const PROBE = new Buffer(1);
PROBE.writeUInt8(0x06, 0);

const ACK = new Buffer(1);
ACK.writeUInt8(0x07, 0);

const HEADER = magic;

var registrationList = {};

/*
*  MESSAGE Helper Functions
*/
var createRegistered = function(message, seqNUM) {
	// setup the lifetime of the user info
	var lifeTime = new Buffer(2);
	lifeTime.writeUInt16BE(24000, 0);

	var res = Buffer.concat([HEADER, seqNUM, REGISTERed, lifeTime]);

	return res;
};

var createFetchRes = function(message, seqNUM) {
	var numEntries = new Buffer(1);
	numEntries.writeUInt8(Object.keys(registrationList).length, 0);
	var res = Buffer.concat([HEADER, seqNUM, FETCHres, numEntries]);

	for (var entry in registrationList) {
		if (registrationList.hasOwnProperty(entry)) {
			var contents = registrationList[entry];
			var entryBuffer = new Buffer(10);
			entryBuffer.write(contents.serviceIP, 0, 4);
			entryBuffer.writeUInt16BE(contents.servicePort, 4);
			entryBuffer.write(contents.serviceData, 6, 4);

			res = Buffer.concat([res, entryBuffer]);
		}
	}

	// registrationList.forEach(function(entry) {
	// 	var entryBuffer = new Buffer(10);
	// 	entryBuffer.write(entry.serviceIP, 0, 4);
	// 	entryBuffer.write(entry.servicePort, 4, 2);
	// 	entryBuffer.write(entry.serviceData, 6, 4);

	// 	res = Buffer.concat([res, entryBuffer]);
	// });

	return res;
};

var createACK = function(message, seqNUM) {
	var res = Buffer.concat([HEADER, seqNUM, ACK]);

	return res;
};

var createProbe = function(chunk, seqNUM) {
    var res = Buffer.concat([HEADER, seqNUM, PROBE]);

    return res;
};


server.on('listening', function () {
    var address = server.address();
    console.log('UDP Server listening on ' + address.address + ":" + address.port);
});

serverProbe.on('listening', function () {
    var address = serverProbe.address();
    console.log('UDP Server listening on ' + address.address + ":" + address.port);
});

serverProbe.on('message', function(message, remote) {
	if (message.readUInt16BE(0) === 0xC461) {
		if (message.readUInt8(3) == '7') {
			console.log('receive ACK from client!!!');
		}
	}
});

server.on('message', function (message, remote) {

	// if the magic number matched, then do following, otherwise ignore it
	if (message.readUInt16BE(0) === 0xC461) {
		// translate client's message type
		var command = [];

		// initialize the message to send back
		var sendBackMsg = [];

		// sequence number should equal to client's sequence number 
		seqNum = message.readUInt8(2);
	    var seqNUM = new Buffer(1);
	    seqNUM.writeUInt8(seqNum, 0);

		// if receive register msg from client
		if (message.readUInt8(3) == '1') {
			command = 'REGISTER from Client';

			// try to store user info in the list
			serviceIP = remote.address;
			var servicePort = message.readUInt16BE(8);
			clientPort = remote.port;
			var serviceData = message.toString('utf8', 10, 14);
console.log(serviceData);
			var serviceName = message.toString('utf-8', 15);
			registrationList[serviceName] = {
				'serviceIP': serviceIP,
				'servicePort': servicePort,
				'serviceData': serviceData
			};
			console.log(registrationList);

			sendBackMsg = createRegistered(message, seqNUM);

		} else if (message.readUInt8(3) == '3') {
			// if server receives FETCH from client
			command = 'FETCH from Client';

			sendBackMsg = createFetchRes(message, seqNUM);
		} else if (message.readUInt8(3) == '5') {
			// if receives Unregister from client
			command = 'Client is trying to ungister.';
			// TODO ================ delete user info after time expired
			sendBackMsg = createACK(message, seqNUM);

		} else if (message.readUInt8(3) == '6') {
			// if receives Probe from client
			command = 'PROBE from Client';
			sendBackMsg = createACK(message, seqNUM);
		} else if (message.readUInt8(3) == '7') {
			// if receives ACK from client, do nothing
			console.log('ACK from Client!!');
			return;
		} else {
			console.log(message.readUInt8(3));
			// if received in different state, just terminate
			console.log('WRONG RESPONSE from client!! DO Nothing!!');
			return;
		}

		// print out client's message
console.log( '0x' + message.readUInt16BE(0).toString(16) + ' ' + '[' + message.readUInt8(2) + ']' + '---' + remote.address + ':' + remote.port +' - ' + command);

		// finally, send back msg to client ---- to remote port + 1!!!
		server.send(sendBackMsg, 0, sendBackMsg.length, remote.port, remote.address);
		
		// set TIMER
		// if (receiveState || initialState) {
		// 	timer = setTimeout(function() {
		// 	    util.log("NO RESPONSE AND SENT GOODBYE!!!!");

		// 	    // if timeout, send GOODBYE and change to done state
		// 	    sendBackMsg = Buffer.concat([HEADER, GOODBYE]);
		// 		var seqNUM = new Buffer(4);
		// 		seqNUM.writeUInt32BE(seqNum++, 0);
		// 		sendBackMsg = Buffer.concat([sendBackMsg, seqNUM, sessionID]);

		// 		server.send(sendBackMsg, 0, sendBackMsg.length, remote.port, remote.address);

		// 		receiveState = false;
		// 		doneState = true;
		// 	}, 50000000);
		// }
	}
});

server.bind(SERVER_PORT);

// Read stdin by lines in this implementation...
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

//  =================== listening on stdin
rl.on('line', function(chunk) {
    setTimer = true;
    // pre-process chunk 
    chunk = chunk.toString().trim().split(' ');

    //add seq number and increment it
    var seqNUM = new Buffer(1);
    seqNUM.writeUInt8(seqNum++, 0);

    // deal with HEADER
    var message = [];
    if (chunk[0] === 'p' && chunk.length === 1) {
        message = createProbe(chunk, seqNUM);
console.log(message);
    } else if (chunk[0] === 'q') {
        console.log('ready to exit');
        process.exit(0);
    } else {
        console.log('bad request! Try Again!');
        setTimer = false;
    }

    // send msg
    if (setTimer === true && serviceIP !== undefined) {
    	// send PROBE to another port of that service ip
console.log(clientPort);
        serverProbe.send(message, 0, message.length, clientPort + 1, serviceIP, function(err) {
        if (err) throw err;
        });

        // set timeout
        // if ( timer === null ) {
        //     timer = setTimeout(function() { 
        //         // if timeout, send GOODBYE to server and wait for response -- if received GOODBYE or still timeout, close the process
        //         util.log("No response");
        //         process.exit(0);
        //      }, 5000);  
        // }
    }

});


process.stdin.on('end', function() {
    util.log("shutdown requested");
    process.exit(0);
});