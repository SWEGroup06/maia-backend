const {google} = require('googleapis');
const calendar = google.calendar('v3');
const people = google.people('v1');

const CONFIG = require('../config.js');

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    CONFIG.serverURL + '/oauth2callback',
);

module.exports = {
  generateAuthUrl(userID, email) {
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/plus.me',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/calendar',
      ],
      state: encodeURIComponent(JSON.stringify({userID, email})),
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

  /**
   * Retrieve the Google email address associated with this account
   * @param {Credentials} token
   * @return {Promise<unknown>}
   */
  getEmail(token) {
    oauth2Client.setCredentials(token);
    return new Promise(function(resolve, reject) {
      people.people.get({
        auth: oauth2Client,
        personFields: 'emailAddresses',
        resourceName: 'people/me',
      }, function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res.data.emailAddresses[0].value);
      });
    });
  },

  /**
   * TODO: Ihowa
   * @param {Credentials} tokens
   * @param {String} title
   * @param {String} startDateTime
   * @param {String} endDateTime
   * @param {Array} emails
   * @return {Promise<unknown>}
   */
  createMeeting(tokens, title, startDateTime, endDateTime, emails) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function(resolve, reject) {
      calendar.events.insert({
        auth: oauth2Client,
        calendarId: 'primary',
        resource: {
          summary: title,
          start: {dateTime: startDateTime},
          end: {dateTime: endDateTime},
          attendees: emails.map((email) => {
            return {email};
          }),
        },
      }, function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
  },

  /**
   * TODO: Ihowa
   * @param {Type} tokens
   * @param {Type} startDateTime
   * @param {Type} endDateTime
   * @return {Promise<unknown>}
   */
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

  /**
   * TODO: Ihowa
   * @param {Type} tokens
   * @param {Type} startDateTime
   * @param {Type} endDateTime
   * @return {Promise<unknown>}
   */
  getEvents(tokens, startDateTime, endDateTime) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function(resolve, reject) {
      calendar.events.list({
        auth: oauth2Client,
        calendarId: 'primary',
        timeMin: startDateTime,
        timeMax: endDateTime,
        maxResults: 1,
        singleEvents: true,
        orderBy: 'startTime',
      }, function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res.data.items);
      });
    });
  },

  /**
   * TODO: Ihowa
   * @param {Type} tokens
   * @param {Type} event
   * @param {Type} startDateTime
   * @param {Type} endDateTime
   * @return {Promise<unknown>}
   */
  updateMeeting(tokens, event, startDateTime, endDateTime) {
    oauth2Client.setCredentials(tokens);
    console.log('id: ', event.id);
    return new Promise(function(resolve, reject) {
      calendar.events.update({
        auth: oauth2Client,
        calendarId: 'primary',
        eventId: event.id,
        event: event,
        resource: {
          summary: event.summary,
          start: {dateTime: startDateTime},
          end: {dateTime: endDateTime},
          attendees: event.attendees,
        },
      }, function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
  },
};
