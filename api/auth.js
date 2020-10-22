const {google} = require('googleapis');

const CONFIG = require('../config.js');

const oauth2Client = new google.auth.OAuth2(
    CONFIG.CLIENT_ID,
    CONFIG.CLIENT_SECRET,
    CONFIG.serverURL + '/oauth2callback',
);

module.exports = {
  generateAuthUrl() {
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/plus.me',
      ],
    });
  },
  getTokens(code) {
    return new Promise(function(resolve, reject) {
      oauth2Client.getToken(code, function(err, tokens) {
        if (err) {
          reject(err);
          return;
        }
        resolve(tokens);
      });
    });
  },
};
