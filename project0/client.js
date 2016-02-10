#!/usr/bin/node
'use strict';

var dgram = require('dgram');
var util = require('util');
var readline = require('readline');
var tty = require('tty');

var PORT = 33333;
var timer = null;

if ( process.argv.length != 3 ) {
    util.log("Usage: nodejs client.js server_host");
    process.exit(1);
}

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

// seq number counter
var seqNum = 0;

// arbitrary session id
var session = Math.random() * (9999999) + 1;
const sessionID = new Buffer(4);
sessionID.writeUInt32LE(session);

// initialize different states
// at the very beginning, we are in hellowait state
var helloWait = true;
var readyState = false;
var readyTimer = false;
var closingState = false;

var serverHost = process.argv[2];

var client = dgram.createSocket('udp4');

// remember whether input is coming from a tty, to try to shut down "cleanly"...
var haveTTY = tty.isatty(process.stdin);

//  =================== listening message from server
client.on('message', function(message,remote) {
    util.log(remote.address + ':' + remote.port +' - ' + message.readUInt16LE(0) + ' ' + message.readUInt8(2));
    
    // check magic number and version
    if (message.readUInt16LE(0) === 0xC461 && message.readUInt8(2) === 0x01) {
        // if receive HELLO from server, change to Ready state and reset timer
        if (message.readUInt8(3) == '0') {
            console.log('Hello from Server');
            readyState = true;
            helloWait = false;
            // only after receiving hello message from server, then we start to read line
            rl.resume();
        } else if (message.readUInt8(3) == '2' && (readyState == true || readyTimer == true || closingState == true)) {
            // if receive ALIVE msg, reset timer
            console.log('ALIVE from Server');
            // if it is in ready state or closing state when receiving ALIVE msg, DO NOT reset timer and just return
            if (readyState == true || closingState == true) {
                return;
            } else if (readyTimer == true && readyState == false) {
                readyTimer = false;
                readyState = true;
            }
        } else if (message.readUInt8(3) == '3') {
console.log('RECEIVE GOODBYE!!');
            // if receive GOODBYE, no matter what state we are in, try to close the process
            // if is in closing state --> already sent goodbyt to server and exit immediately
            if (closingState == true) {
                console.log('YOU ARE DIED!');
                process.exit(0);
            }
            // if it is not in closing state --> that is before senting goodbye to server
            closingState = true;
console.log('GOOOOOOOOOOODBYE!!!');
            rl.close();
        }
    }

    // if receive any msg, cancel timer --> reset timer is done by rl.line rather than socket.message
    if ( timer ) clearTimeout(timer);
    timer = null;
});

// Read stdin by lines in this implementation...
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

// =================== before senting any msg, sent HELLO at first!!
rl.pause();

//add HEADER

var seqNUM = new Buffer(4);
seqNUM.writeUInt32LE(seqNum++, 0);
var helloMsg = Buffer.concat([HEADER, HELLO, seqNUM, sessionID]);

client.send(helloMsg, 0, helloMsg.length, PORT, serverHost, function(err, bytes) {
if (err) throw err;
});

console.log('HELLO SENT!!');

timer = setTimeout(function() {
    util.log("NO HELLO FROM SERVER!!!!");
    rl.close();
}, 5000);


//  =================== listening on stdin
rl.on('line', function(chunk) {
    // if receive any data from stdin, put them into msg and send to server -- including HEADER!!
    chunk = chunk.toString().trim();

    // deal with HEADER
    var message = [];
    if (readyState && !readyTimer) {
        // if it is in ready state, send data with DATA msg, and change state to ready timer
        message = Buffer.concat([HEADER, DATA]);
        readyState = false;
        readyTimer = true;

    } else if (readyTimer && !readyState) {
        // if it is in ready timer, DO NOT change state and just send data
        message = Buffer.concat([HEADER, DATA]);
    } else if (chunk == 3) {
        message = Buffer.concat([HEADER, GOODBYE]);
    } 

    if (chunk == 'q') {
        // if input q, terminate process
        // change state to closing
        rl.close();
        return;
    }

    //add seq number and increment it afterwards and add sessionID and data from stdin
    var seqNUM = new Buffer(4);
    seqNUM.writeUInt32LE(seqNum++, 0);
    message = Buffer.concat([message, seqNUM, sessionID, new Buffer(chunk)]);

    client.send(message, 0, message.length, PORT, serverHost, function(err, bytes) {
    if (err) throw err;
    });

    // if it is in ready state, reset timer -- if it is in ready timer state, DO NOT reset timer
    if ((readyState && !readyTimer)) {
        if ( timer == null )
        timer = setTimeout(function() { 
            // if timeout, send GOODBYE to server and wait for response -- if received GOODBYE or still timeout, close the process
            util.log("No response");
            rl.close();
         }, 5000);
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
        seqNUM.writeUInt32LE(seqNum++, 0);
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