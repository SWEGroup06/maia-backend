const {google} = require('googleapis');
const calendar = google.calendar('v3');

const CONFIG = require('../config.js');

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    CONFIG.serverURL + '/oauth2callback',
);

module.exports = {
  generateAuthUrl(email) {
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/plus.me',
      ],
      state: encodeURIComponent(JSON.stringify({email})),
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
  createMeeting(tokens, title, startDateTime, endDateTime) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function(resolve, reject) {
      calendar.events.insert({
        auth: oauth2Client,
        calendarId: 'primary',
        resource: {
          summary: title,
          start: {dateTime: startDateTime},
          end: {dateTime: endDateTime},
        },
      }, function(calendarError, calendarResponse) {
        if (calendarError) {
          reject(calendarError); return;
        }
        resolve(calendarResponse);
      });
    });
  },
  getBusySchedule(tokens, startDateTime, endDateTime) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function(resolve, reject) {
      calendar.freebusy.query({
        auth: oauth2Client,
        resource: {
          items: [{id: 'primary'}],
          timeMin: startDateTime,
          timeMax: endDateTime,
        },
      }, function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res.data.calendars.primary.busy);
      });
    });
  },

};
