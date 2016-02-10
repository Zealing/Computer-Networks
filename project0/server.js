#!/usr/bin/node
'use strict';

var dgram = require('dgram');
var util = require('util');
var readline = require('readline');
var fs = require('fs');

var SERVER_PORT = 33333;

var server = dgram.createSocket('udp4');

var initialState = true;
var receiveState = false;
var doneState = false;

var seqNum = 0;

// check the next packet id
var receivedPacketNum = 0;
// check the last received packet id
var lastReceivedNum = 0;

var timer = null;

// initialize header and const commands
const magic = new Buffer(2);
magic.writeUInt16LE(0xC461, 0);

const version = new Buffer(1);
version.writeUInt8(0x01, 0);

const HELLO = new Buffer(1);
HELLO.writeUInt8(0x00, 0);

const DATA = new Buffer(1);
DATA.writeUInt8(0x01, 0);

const ALIVE = new Buffer(1);
ALIVE.writeUInt8(0x02, 0);

const GOODBYE = new Buffer(1);
GOODBYE.writeUInt8(0x03, 0);

const HEADER = Buffer.concat([magic, version]);

const sessionID = new Buffer(4);
sessionID.writeUInt32LE(8);


server.on('listening', function () {
    var address = server.address();
    console.log('UDP Server listening on ' + address.address + ":" + address.port);
});

server.on('message', function (message, remote) {

	// if the magic number matched, then do following, otherwise ignore it
	if (message.readUInt16LE(0) === 0xC461 && message.readUInt8(2) === 0x01 && doneState == false) {
		// translate client's message type
		var command = [];

		// initialize the message to send back
		var sendBackMsg = [];

console.log(message.toString('utf-8', 12));

		// if receive hello from client, send back heollo and set timer and transfer state
		if (message.readUInt8(3) == '0' && initialState === true && receiveState == false) {
			command = 'HELLO from Client';
			receiveState = true;
			initialState = false;

			// add command
			sendBackMsg = Buffer.concat([HEADER, HELLO]);

		} else if (message.readUInt8(3) == '1' && receiveState == true) {
			// if server is in receive state and receive a data command, send back alive and refresh timer
			command = 'DATA from Client';

			// add command and seq number to send back message to client
			sendBackMsg = Buffer.concat([HEADER, ALIVE]);

			// cancel TIMER
		    if ( timer ) clearTimeout(timer);
		    timer = null;
		} else if (message.readUInt8(3) == '2' && receiveState == true) {
			command = 'Client is ALIVE';

			// add command and seq number to send back message to client
			sendBackMsg = Buffer.concat([HEADER, ALIVE]);

		} else if (message.readUInt8(3) == '3' && receiveState == true) {
			// if is in receive state and receive goodbye command, send back a goodbye message and terminate the session
			command = 'GOODBYE from Client';

			// add command
			sendBackMsg = Buffer.concat([HEADER, GOODBYE]);

			// send back message to client

			receiveState = false;
			doneState = true;

			// if receive GOODBYE, also cancel TIMER
		    if ( timer ) clearTimeout(timer);
		    timer = null;
		} else if (doneState == true) {
			// if it is done, just return and do NOTHING??
console.log('fxxxxxxxxxxxxxk');

			return;
		} else {
			// if received in different state, just terminate
			doneState = true;
console.log('asdfasdfasdfasdfasdfadsf');
			return;
		}

		// after processing specific commands, we should check the seq number
		// we already incremented seq number by one when last msg arrived, so just using seqNum
		var receivedSeqNum = message.readUInt32LE(4);

		// if expected next num < received num --> lost packet
		if (receivedPacketNum < receivedSeqNum) {
			console.log('Lost Packet!!');
			receivedPacketNum = receivedSeqNum;
		} else if (receivedPacketNum == receivedSeqNum + 1) {
			// if received packet num repeated last received packet num -> duplicate
			console.log('Duplicate Packet!!!');
			receivedPacketNum = receivedSeqNum;
		} else if (receivedPacketNum > receivedSeqNum + 1) {
			// if received packet num less than last received packet num --> protocol error -- terminate
console.log('PACKET ERROR!! TRY TO TERMINATE!!');
			// add command 
			sendBackMsg = Buffer.concat([HEADER, GOODBYE]);

			receiveState = false;
			doneState = true;
		}

		// print out client's message
console.log( '0x' + message.readUInt32LE(8).toString(16) + ' ' + '[' + message.readUInt32LE(4) + ']' + '---' + remote.address + ':' + remote.port +' - ' + command);

		// increment expected received packet num next time
		receivedPacketNum += 1;

		// add HEADER to sendbackMsg
		var seqNUM = new Buffer(4);
		seqNUM.writeUInt32LE(seqNum++, 0);

		sendBackMsg = Buffer.concat([sendBackMsg, seqNUM, sessionID]);

		// finally, send back msg to client
		server.send(sendBackMsg, 0, sendBackMsg.length, remote.port, remote.address);

		// update the last received packet id
		lastReceivedNum = receivedSeqNum;

		// set TIMER
		if (receiveState || initialState) {
			timer = setTimeout(function() {
			    util.log("NO RESPONSE AND SENT GOODBYE!!!!");

			    // if timeout, send GOODBYE and change to done state
			    sendBackMsg = Buffer.concat([HEADER, GOODBYE]);
				var seqNUM = new Buffer(4);
				seqNUM.writeUInt32LE(seqNum++, 0);
				sendBackMsg = Buffer.concat([sendBackMsg, seqNUM, sessionID]);

				server.send(sendBackMsg, 0, sendBackMsg.length, remote.port, remote.address);

				receiveState = false;
				doneState = true;
			}, 50000000);
		}


	    // Need to respond either with the client's string or else the contents
	    // of the file it names, if it names one.
	    // Try to open file and handle success and failure differently.
	    // var filename = './datafiles/' + message;
	    // // console.log(filename);
	    // var filestream = fs.createReadStream(filename);

	    // // Success opening file
	    // filestream.on('open', function() {
	    //     var buf = new Buffer("Sending contents of file " + message);
	    //     // Send file contents line by line
	    //     server.send(buf, 0, buf.length, remote.port, remote.address);
	    //     var rl = readline.createInterface({
	    //         input: filestream,
	    //         output: process.stdout,
	    //         terminal: false
	    //     });
	    //     rl.on('line', function(line) {
	    //         var buf  = new Buffer('+ ' + line);
	    //         server.send(buf, 0, buf.length, remote.port, remote.address);
	    //     } );
	    //     rl.on('close', function() {
	    //         var buf = new Buffer("Done sending contents of file " + message);
	    //         server.send(buf, 0, buf.length, remote.port, remote.address);
	    //     });
	    // });

	    // // Failure opening file - just echo client's message
	    // filestream.on('error', function(err) {
	    //     server.send(HEADER, 0, HEADER.length, remote.port, remote.address);
	    // });
	}
});

server.bind(SERVER_PORT);

process.stdin.on('data', function(chunk){
});

process.stdin.on('end', function() {
    util.log("shutdown requested");
    process.exit(0);
});