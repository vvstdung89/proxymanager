#!/usr/bin/env node
'use strict';
var net = require('net'), tls = require('tls');
var HTTPParser = process.binding('http_parser').HTTPParser;
var http = require('http'), https = require('https');
var url = require('url');

module.exports = main

function main(local_host, local_port, remote_host, remote_port, usr, pwd, callback) {
	var buf_proxy_basic_auth = new Buffer('Proxy-Authorization: Basic ' + new Buffer(usr + ':' + pwd).toString('base64'));
	createPortForwarder(local_host, local_port, remote_host, remote_port, buf_proxy_basic_auth, false, true, callback);
}

var CR = 0xd, LF = 0xa, BUF_CR = new Buffer([0xd]), BUF_CR_LF_CR_LF = new Buffer([0xd, 0xa, 0xd, 0xa]), BUF_LF_LF = new Buffer([0xa, 0xa]);
var STATE_NONE = 0, STATE_FOUND_LF = 1, STATE_FOUND_LF_CR = 2;


function createPortForwarder(local_host, local_port, remote_host, remote_port, buf_proxy_basic_auth, is_remote_https, ignore_https_cert, callback) {
	
	function closeConnect(){
		netopen.close()
	}

	var netopen = net.createServer({ allowHalfOpen: true }, function (socket) {
		//function handler every request to this server
		
		//create conenction to remote proxy
		var realCon = (is_remote_https ? tls : net).connect({
			port: remote_port, host: remote_host, allowHalfOpen: true,
			rejectUnauthorized: !ignore_https_cert /*not used when is_remote_https false*/
		});

		realCon.on('data', function (buf) {
			//console.log('<<<<' + (Date.t=new Date()) + '.' + Date.t.getMilliseconds() + '\n' + buf.toString('ascii'));
			socket.write(buf);
			realCon.__haveGotData = true;
		}).on('end', function () {
			socket.end();
			if (!realCon.__haveGotData && !realCon.__haveShownError) {
				console.error('[LocalProxy(:' + local_port + ')][Connection to ' + remote_host + ':' + remote_port + '] Error: ended by remote peer');
				realCon.__haveShownError = true;
			}
		}).on('close', function () {
			socket.end();
			if (!realCon.__haveGotData && !realCon.__haveShownError) {
				console.error('[LocalProxy(:' + local_port + ')][Connection to ' + remote_host + ':' + remote_port + '] Error: reset by remote peer');
				realCon.__haveShownError = true;
			}
		}).on('error', function (err) {
			console.error('[LocalProxy(:' + local_port + ')][Connection to ' + remote_host + ':' + remote_port + '] ' + err);
			realCon.__haveShownError = true;
		});

		var parser = new HTTPParser(HTTPParser.REQUEST);
		parser[HTTPParser.kOnHeadersComplete] = function () {
			//console.log('---- kOnHeadersComplete----');
			//console.log(arguments);
			parser.__is_headers_complete = true;
		};
		//parser[HTTPParser.kOnMessageComplete] = function () {
		//    console.log('---- kOnMessageComplete----');
		//    console.log(arguments);
		//};

		var state = STATE_NONE;

		socket.on('data', function (buf) {
			//console.log('[' + remote_host + ':' + remote_port + ']>>>>' + (Date.t = new Date()) + '.' + Date.t.getMilliseconds() + '\n' + buf.toString('ascii'));
			//var ret = parser.execute(buf);
			//console.log('\n\n----parser result: ' + ret + ' buf len:' + buf.length);
			//realCon.write(buf);
			//return;

			var buf_ary = [], unsavedStart = 0, buf_len = buf.length;

			//process orphan CR
			if (state === STATE_FOUND_LF_CR && buf[0] !== LF) {
				parser.execute(BUF_CR);
				buf_ary.push(BUF_CR);
			}
			for (var i = 0; i < buf_len; i++) {
				//find first LF
				if (state === STATE_NONE) {
					if (buf[i] === LF) {
						state = STATE_FOUND_LF;
					}
					continue;
				}

				//find second CR LF or LF
				if (buf[i] === LF) {
					parser.__is_headers_complete = false;
					parser.execute(buf.slice(unsavedStart, i + 1));

					if (parser.__is_headers_complete) {
						buf_ary.push(buf.slice(unsavedStart, buf[i - 1] === CR ? i - 1 : i));
						//console.log('insert auth header');
						buf_ary.push(buf_proxy_basic_auth);
						buf_ary.push(state === STATE_FOUND_LF_CR ? BUF_CR_LF_CR_LF : BUF_LF_LF);

						unsavedStart = i + 1;
						state = STATE_NONE;
					}
					else {
						state = STATE_FOUND_LF;
					}
				}
				else if (buf[i] === CR && state === STATE_FOUND_LF) {
					state = STATE_FOUND_LF_CR;
				} else {
					state = STATE_NONE;
				}
			}
			if (unsavedStart < buf_len) {
				//strip last CR if found LF_CR
				buf = buf.slice(unsavedStart, state === STATE_FOUND_LF_CR ? buf_len - 1 : buf_len);
				if (buf.length) {
					parser.execute(buf);
					buf_ary.push(buf);
				}
			}
			buf = Buffer.concat(buf_ary);
			realCon.write(buf);

		}).on('end', cleanup).on('close', cleanup).on('error', function (err) {
			// console.error('[LocalProxy(:' + local_port + ')][Incoming connection] ' + err);
			// if (callback && typeof callback == "function") callback()
		});

		function cleanup() {
			if (parser) {
				parser.close();
				parser = null;
			}
			realCon.end();
		}
	}).on('error', function (err) {
		console.error('[LocalProxy(:' + local_port + ')] ' + err);
		// if (callback && typeof callback == "function") callback()
	}).listen(local_port, local_host === '*' ? undefined : local_host, function () {
		console.log('[LocalProxy(:' + local_port + ')] OK: forward http://' + local_host + ':' + local_port + ' to ' + ' to http' + (is_remote_https ? 's' : '') + '://' + remote_host + ':' + remote_port);
		if (callback && typeof callback == "function") callback(closeConnect)
	});
}
