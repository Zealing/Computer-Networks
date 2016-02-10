#!/usr/bin/node
'use strict';

var dgram = require('dgram');
var util = require('util');
var readline = require('readline');
var tty = require('tty');

var timer = null;
var setTimer = true; // flag

// service port is q
// const servicePort = 12345;

// ========== determine server addr and port
// default is localhost 33333
var serverHost = process.argv[2];
var serverPort = process.argv[3];

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

// seq number counter
var seqNum = 0;

// initialize different states
// at the very beginning, we are in hellowait state
var helloWait = true;
var readyState = false;
var readyTimer = false;
var closingState = false;

var client = dgram.createSocket('udp4').bind(12345);
var clientListen = dgram.createSocket('udp4').bind(12346);

client.on('listening', function () {
    var address = client.address();
    console.log('UDP Server listening on ' + address.address + ":" + address.port);
});

clientListen.on('listening', function () {
    var address = clientListen.address();
    console.log('UDP Server listening on ' + address.address + ":" + address.port);
});

// service and agent's address --- default is localhost
const clientAddr = new Buffer(4);
clientAddr.writeUInt8(127, 0);
clientAddr.writeUInt8(0, 1);
clientAddr.writeUInt8(0, 2); 
clientAddr.writeUInt8(1, 3);

// remember whether input is coming from a tty, to try to shut down "cleanly"...
var haveTTY = tty.isatty(process.stdin);

//  =================== listening message from server
client.on('message', function(message,remote) {
    util.log(remote.address + ':' + remote.port +' - ' + message.readUInt16BE(0) + ' ' + message.readUInt8(2));
    
    // check magic number
    if (message.readUInt16BE(0) === 0xC461) {
        // if receive registered response from server
        if (message.readUInt8(3) == '2') {
            console.log('REGISTERED from Server');
            console.log('life time is: ' + message.readUInt16BE(4));
        } else if (message.readUInt8(3) == '4') {
            // if receive FETCH RESPONSE msg, print them to screen
            console.log('FETCH RESPONSE from Server');
            var numEntries = message.readUInt8(4);
            for (var i = 0; i < numEntries; i++) {
                var serviceData = message.readUIntBE(11 + 10 * i, 4);
                var servicePort = message.readUInt16BE(9 + 10 * i, 2);
                var serviceIP = message.readUInt8(5 + 10 * i, 1) + '.' + message.readUInt8(6 + 10 * i, 1) + '.' +message.readUInt8(7 + 10 * i, 1) + '.' +message.readUInt8(8 + 10 * i, 1);
                console.log(serviceData);
                console.log(servicePort);
                console.log(serviceIP);
            }
        } else if (message.readUInt8(3) == '7') {
            // if receive ACK from server
console.log('RECEIVE ACK!!');
        } else {
            console.log('WRONG MSG from Server!!');
        }
    }

    // if receive any msg, cancel timer
    if ( timer ) clearTimeout(timer);
    timer = null;
});


clientListen.on('message', function(message,remote) {
    util.log(remote.address + ':' + remote.port +' - ' + message.readUInt16BE(0) + ' ' + message.readUInt8(2));
    
    // check magic number
    if (message.readUInt16BE(0) === 0xC461) {
        // if receive PROBE from sever, try to send back ACK to server ip and port
        if (message.readUInt8(3) == '6') {
            console.log('PROBE from Server');
            console.log('try to send back ACK');
            var seqNUM = message.slice(2, 3);
console.log(seqNUM);
            var msg = Buffer.concat([HEADER, seqNUM, ACK]);

            client.send(msg, 0, msg.length, remote.port, remote.address, function(err) {
            if (err) throw err;
            });

        } else {
            console.log('WRONG MSG from Server!!');
        }
    }
});

// Read stdin by lines in this implementation...
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

/*
 * ========== Message Helper Functions -- did not use inheritance in this time
 */

var createRegister = function(chunk, seqNUM) {
    var clientPort = new Buffer(2);
    clientPort.writeUInt16BE(chunk[1], 0);

    // should be an 32 uint rather than string -- default
    var serviceData = new Buffer(4);
    serviceData.writeUInt32BE(chunk[2], 0);

    var serviceNameLen = new Buffer(1);
    serviceNameLen.writeUInt8(chunk[3].length, 0);

    var serviceName = new Buffer(chunk[3]);

    var res = Buffer.concat([HEADER, seqNUM, REGISTER, clientAddr, clientPort, serviceData, serviceNameLen, serviceName]);

    return res;
};

var unRegister = function(chunk, seqNUM) {
    var clientPort = new Buffer(2);
    clientPort.writeUInt16BE(chunk[1], 0);

    var res = Buffer.concat([HEADER, seqNUM, UNREGISTER, clientAddr, clientPort]);

    return res;
};

var createProbe = function(chunk, seqNUM) {

    var res = Buffer.concat([HEADER, seqNUM, PROBE]);

    return res;

};

var createFetch = function(chunk, seqNUM) {

    var serviceNameLen = new Buffer(1);
    serviceNameLen.writeUInt8(chunk[1].length, 0);

    var serviceName = new Buffer(chunk[1]);

    var res = Buffer.concat([HEADER, seqNUM, FETCH, serviceNameLen, serviceName]);

    return res;
};

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
    if (chunk[0] === 'r' && chunk.length === 4) {
        message = createRegister(chunk, seqNUM);
console.log(message);
    } else if (chunk[0] === 'u' && chunk.length === 2) {
        message = unRegister(chunk, seqNUM);
console.log(message);
    } else if (chunk[0] === 'p' && chunk.length === 1) {
        message = createProbe(chunk, seqNUM);
console.log(message);
    } else if (chunk[0] === 'f' && chunk.length === 2) {
        message = createFetch(chunk, seqNUM);
console.log(message);
    } else if (chunk[0] === 'q') {
        console.log('ready to exit');
        process.exit(0);
    } else {
        console.log('bad request! Try Again!');
        setTimer = false;
    }

    // send msg
    if (setTimer === true) {
        client.send(message, 0, message.length, serverPort, serverHost, function(err, bytes) {
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

// On eof, done
// SHOULD BE THE closing STATE!!! -- sending and waiting for GOODBYE
rl.on('close', function() { 
    util.log("eof");

    // if it is not in closing state, change state and send GOODBYE
    if (!closingState) {
        // change state to closing
        helloWait = false;
        readyState = false;
        readyTimer = false;
        closingState = true;

        //add header
        var seqNUM = new Buffer(4);
        seqNUM.writeUInt32BE(seqNum++, 0);
        var message = Buffer.concat([HEADER, GOODBYE, seqNUM, sessionID]);

        client.send(message, 0, message.length, PORT, serverHost, function(err, bytes) {
        if (err) throw err;
        });

console.log('GOODBYE SENT!!!');

        // and continue to wait another period of time until timeout
        timer = setTimeout(function() {
            util.log("No GOOOOOOOOOOODBYE response! Ready to close the process!!!");
            if (haveTTY) process.exit(0);
        }, 5000);
    } 
});
