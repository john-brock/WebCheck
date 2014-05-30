WebCheck
========

Check an HTTP service every N seconds to ensure it is responding to requests.

WebCheck will send a notification email to all specified recipients if the response from the HTTP service cannot be verified or doesn't match the expected response.

<strong>Setup</strong><br>
1) install nodejs http://nodejs.org/download/<br>
2) `git clone https://github.com/john-brock/WebCheck`<br>
3) execute `npm install`<br>
4) update config values in config.json (note: see /node_modules/nodemailer/lib/wellknown.js for other email service options)<br>
5) set email username and password environment variables `export EMAIL_USERNAME=username` or `heroku config:set EMAIL_USERNAME=username`<br>
6) run the monitoring server `node app.js`<br>
7) start the monitoring service by hitting `/start` - you will receive a confirmation email<br>
8) stop the monitoring service by hitting `/stop` - you will receive a confirmation email<br>
