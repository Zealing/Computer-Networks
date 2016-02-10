#!/usr/bin/node
'use strict';

const ReqList = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE'];

var net = require('net');

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
    
    // Add a 'data' event handler to this instance of socket
    sock.on('data', function(data) {
        // create new client socket to sent browser's data to destination
        var client = new net.Socket({allowHalfOpen: true});

        // get first line of data for further use
        var parseReq = data.toString('utf-8').split('\n')[0];

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
console.log(rawHost);
        var Host = rawHost.toString('utf-8').split(' ')[1].split(',')[0];

        if (validateReq(Request)) {

        	console.log('>>> ' + Request + ' ' + URI() + ' ' + cPort);

        	console.log('>>> ' + 'HOST: ' + Host);
        } 
		console.log('DATA ' + sock.remoteAddress + ': \n' + data);


		sock.pause();
		client.connect(cPort, Host);

		client.on('connect', function()
		{
console.log('CONNECTED TO DESTINATION!!');

			sock.write('HTTP/1.1 200 OK\r\n');
			// Write request to your node.js application
			client.write(data);

		});
        
		client.on('data', function(cdata)
		{
console.log('RECEIVE SOMETHING FROM DESTINATION!!');
console.log(cdata.toString('utf-8'));
			sock.resume();
			// Write client data to browser
			sock.write(cdata);
			// sock.pipe(sock);
			// sock.end();
		});

		client.on('end', function(){
			// sock.end();
			client.destroy();
		});

        // Write the data back to the socket, the client will receive it as data from the server
        // sock.write('You said "' + data + '"');
        
    });
    
    // Add a 'close' event handler to this instance of socket
    // sock.on('close', function(data) {
    //     console.log('CLOSED: ' + sock.remoteAddress +' '+ sock.remotePort);
    // });

    // Add a 'close' event handler to this instance of socket
    // sock.on('end', function(data) {
    //     console.log('END: ' + sock.remoteAddress +' '+ sock.remotePort);
    // });
    
}).listen(PORT, HOST);

server.on('error', function (err){
  // Error processing i just pass whole object
  console.log(err);
});

console.log('Server listening on ' + HOST +':'+ PORT);








