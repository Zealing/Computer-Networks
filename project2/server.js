#!/usr/bin/node
'use strict';

process.on('uncaughtException', function(err) {
	console.log(err.stack);
});

const ReqList = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE'];

var sys = require('util');
var net = require('net');
var url = require('url');

var HOST = '127.0.0.1';
var PORT = 6969;

var validateReq = function(req) {
	if (ReqList.indexOf(req) !== -1) {
		return true;
	}
	return false;
};

var server = net.createServer({allowHalfOpen: true}, function(sock) {
    
    // We have a connection - a socket object is assigned to the connection automatically
    console.log('CONNECTED: ' + sock.remoteAddress +':'+ sock.remotePort);

    var client = '';

    var isClientClosed = false;
    
    // Add a 'data' event handler to this instance of socket
    sock.on('data', function(data) {
console.log(data.toString('utf-8'));
    	sock.pause();

        // get first line of data for further use
        var parseReq = data.toString('utf-8').split(/\n/)[0];

        // get request from header
        var Request = parseReq.toUpperCase().split(' ')[0];

        var cPort;

        // get URI from header
        var URI = function() {
        	var rawText = parseReq.toLowerCase().split(' ')[1].split(':');
        	// var trueURI;
        	if (rawText[2] !== undefined) {
        		cPort = rawText[2];
        		// return trueURI = rawText[0].concat(rawText[1]);
        	}
        	if (rawText[0] === 'http') {
        		cPort = 80;
        		// trueURI = rawText[1];
        	} else if (rawText[0] === 'https') {
        		cPort = 443;
        		// trueURI = rawText[1];
        	} else {
        		cPort = rawText[1];
        		return rawText[0];
        	}
        	return rawText[0].concat(rawText[1]);
        };

        // if cannot find port num, set it to 80 by default
        if (cPort === undefined) {
        	cPort = 80;
        }

        // get host name from header
        var re = /host:\w*([^:\r\n]+)/i;
        var rawHost = data.toString('utf-8').match(re);
		// console.log(rawHost);
        var Host;

        // if the data is a request, create a new socket 
        if (validateReq(Request)) {

	        // create new client socket to sent browser's data to destination
        	client = new net.Socket({allowHalfOpen: true});

        	Host = rawHost.toString('utf-8').split(' ')[1].split(',')[0];

        	console.log('>>> ' + Request + ' ' + URI() + ' ' + cPort);

        	console.log('>>> ' + 'HOST: ' + Host);

        	// try to connect dest
			client.connect(cPort, Host);

			client.on('connect', function()
			{
				console.log('CONNECTED TO DESTINATION!!');
				if (Request === 'CONNECT') {
					sock.pause();
					sock.write("HTTP/1.0 200 OK\r\nConnection: close\r\n\r\n");
					sock.resume();
				} else {
					client.write(data);
				}
			});

			console.log('DATA ' + sock.remoteAddress + ': \n' + data);
	        
	        // handle data from dest
			client.on('data', function(cdata)
			{

				console.log(cdata.toString('utf-8'));
				if (isClientClosed) {
					client.end();
					return;
				}
				sock.pause();
				client.pause();
				console.log('RECEIVE SOMETHING FROM DESTINATION!!');
				
				// Write client data to browser
				sock.write(cdata);
				sock.resume();
				client.resume();
				// sock.pipe(sock);
				// sock.end();
			});

			client.on('end', function(){
				console.log('dest is disconnected');
				sock.end();
				client = '';
			});

			client.on('close', function() {
				console.log('dest has been disconnected');
				sock.end();
				client = '';
			});

			client.on('error', function(err) {
				console.log("socket error! " + err);
				sock.end();
				client = '';
			});
        } else {
        	if (client !== '') {
        		client.pause();
        		sock.pause();
        		client.write(data);
        		sock.resume();
        		client.resume();
        	}
        }


        // Write the data back to the socket, the client will receive it as data from the server
        // sock.write('You said "' + data + '"');
        
    });
    
    //Add a 'close' event handler to this instance of socket
    sock.on('close', function() {
    	console.log('client is closed');
        console.log('CLOSE: ' + sock.remoteAddress +' '+ sock.remotePort);
        if (client !== '') {
        	client.end();
        	client = '';
        }
        isClientClosed = true;
    });

    //Add a 'close' event handler to this instance of socket
    sock.on('end', function() {
    	console.log('client disconnected');
        console.log('END: ' + sock.remoteAddress +' '+ sock.remotePort);
        if (client !== '') {
        	client.end();
        	client = '';
        }
        isClientClosed = true;
    });

    sock.on('error', function(err) {
    	console.log('client error! ' + err);
        if (client !== '') {
        	client.end();
        	client = '';
        }
        isClientClosed = true;
    });
    
}).listen(PORT, HOST);

// server.on('error', function (err){
//   // Error processing i just pass whole object
//   console.log(err);
// });

console.log('Server listening on ' + HOST +':'+ PORT);








