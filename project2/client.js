#!/usr/bin/node
'use strict';

var net = require('net');

var HOST = '127.0.0.1';
var PORT = 6969;

var client = new net.Socket();
client.connect(PORT, HOST, function() {

    console.log('CONNECTED TO: ' + HOST + ':' + PORT);
    // Write a message to the socket as soon as the client is connected, the server will receive it as message from the client 
    client.write('I am Chuck Norris!');

});

// Add a 'data' event handler for the client socket
// data is what the server sent to this socket
client.on('data', function(data) {
    
    console.log('DATA: ' + data);
    // Close the client socket completely
    client.end();
    
});

// Add a 'close' event handler for the client socket
client.on('end', function() {
    console.log('Connection end from server');
});

// Add a 'close' event handler for the client socket
client.on('close', function() {
    console.log('Connection closed from server');
});