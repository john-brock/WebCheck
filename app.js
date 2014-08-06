// app.js
var express = require('express');
var logfmt = require('logfmt');
var nodemailer = require('nodemailer');
var util = require('util');
var dateFormat = require('dateformat');
var request = require('request');
var config = require('./config.json');

var app = express();
app.use(logfmt.requestLogger());

var intervalInSeconds = config['interval_in_seconds'];
var timeoutInSeconds = config['timeout_in_seconds'];
var endpoint = config['endpoint'];
var endpointTitle = config['endpoint_title'];
var checkSsl = config['check_ssl'];
var bodyText = config['body_text_to_check'];
var emailsToNotify = config['emails_to_notify_on_error'];
var emailService = process.env.EMAIL_SERVICE || config['email_service'];
var username = process.env.EMAIL_USERNAME;
var password = process.env.EMAIL_PASSWORD;

var monitorOn = false;
var timerId;

var mailer = nodemailer.createTransport('SMTP', {
	service: emailService,
	auth: {
		user: username,
		pass: password
	}
});

function monitor() {
	timerId = setInterval(function() {
		checkEndpoint(endpoint, function(err) {
			if(null != err && err.length > 0) {
				logfmt.log({'endpoint_error' : err});
				notifyRecipientsOfError(err, getDateNow());
			} else {
				logfmt.log({'endpoint_success' : 'Endpoint response verified'});
			}
		});
	}, intervalInSeconds*1000);
}

function checkEndpoint(endpoint, callback) {
	request({ uri: endpoint, strictSSL: checkSsl, timeout: timeoutInSeconds*1000 }, function(err, resp, body) {
		var error;
		if (err) {
			var baseError = 'Request timed out';
			error = checkSsl ? baseError + ' or SSL was expired / invalid' : baseError;
		} else if (resp.statusCode != 200) {
			error = 'Status code was not expected: ' + resp.statusCode;
		} else if (null != bodyText && bodyText.length > 0) {
			if (JSON.stringify(body).indexOf(bodyText) == -1) {
				error = 'Expected body text not found in response';
			}
		}
		callback(error);
	});
}

function notifyRecipientsOfError(error, dateTime) {
	var subject = util.format('[URGENT] %s needs attention', endpointTitle);
	var bodyText = util.format('%s did not respond successfully to WebCheck. Error: %s. %s', endpoint, error, dateTime);
	sendEmail(subject, bodyText);
}

function notifyOfMonitoringStatusChange(turnedOn, dateTime) {
	var subject = util.format('[INFO] %s monitor turned %s', endpointTitle, turnedOn ? 'ON' : 'OFF');
	var bodyText = util.format('Please ensure this is the desired WebCheck state. Change made on %s.', dateTime);
	sendEmail(subject, bodyText);
}

function sendEmail(subject, bodyText) {
	var mailOptions = {
		from: util.format('WebCheck <%s>', username),
		to: emailsToNotify.join(','),
		subject: subject,
		text: bodyText,
		html: '<b>' + bodyText + '<b>'
	};
	mailer.sendMail(mailOptions, function(err, resp) {
		if(null != err) {
			logfmt.log({'email_error': JSON.stringify(err)});
		} else {
			logfmt.log({'email_success': resp.message});
		}
	})
}

function toggleMonitoringService(turnOn, sendEmail, callback) {
	var msgToSend;
	var baseMsg = 'Monitoring service ';
	if (monitorOn == turnOn) {
		msgToSend = baseMsg + util.format('already turned %s.', monitorOn ? 'on' : 'off');
	} else {
		if (turnOn) {
			monitor();
		} else {
			clearInterval(timerId);
		}
		monitorOn = turnOn;
		msgToSend = baseMsg + util.format('turned %s!', turnOn ? 'ON' : 'OFF');
		if (sendEmail) { notifyOfMonitoringStatusChange(turnOn, getDateNow()); }
	}
	callback(msgToSend);
}

function getDateNow() {
	return dateFormat(Date.now(), "dddd, mmmm dS, yyyy, h:MM:ss TT");
}

app.get('/', function(req, res) {
	var baseMessage = util.format('The monitoring service for %s is currently %s.', endpoint, monitorOn ? 'ON' : 'OFF');
	var instructions = '\n\n/start will turn monitoring on\n/stop will turn monitoring off';
	res.setHeader('content-type', 'text/plain');
	res.send(baseMessage + instructions);
});

app.get('/start', function(req, res) {
	toggleMonitoringService(true, true, function(msg) {
		res.send(msg);
	});
});

app.get('/stop', function(req, res) {
	toggleMonitoringService(false, true, function(msg) {
		res.send(msg);
	});
});

var port = Number(process.env.PORT || 5050);
app.listen(port, function() {
	console.log('Monitoring service server started on port: ' + port);
	toggleMonitoringService(true, false, function(msg) {});
});
