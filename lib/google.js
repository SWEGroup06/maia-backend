const {google} = require('googleapis');
const calendar = google.calendar('v3');
const people = google.people('v1');

const CONFIG = require('../config.js');

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    CONFIG.serverURL + '/auth/callback',
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
   * Create meeting in user's calendar with associated attendees
   * @param {Credentials} tokens
   * @param {String} title
   * @param {String} startDateTime
   * @param {String} endDateTime
   * @param {Array} emails
   * @param {String} description
   * @return {Promise<unknown>}
   */
  createMeeting(tokens, title, startDateTime, endDateTime, emails, description) {
    oauth2Client.setCredentials(tokens);
    console.log('dee', description);
    return new Promise(function(resolve, reject) {
      calendar.events.insert({
        auth: oauth2Client,
        calendarId: 'primary',
        resource: {
          summary: title,
          description: description,
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
   * Gets busy schedule of user for scheduling purposes
   * @param {Credentials} tokens
   * @param {String} startDateTime
   * @param {String} endDateTime
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
   * Get all scheduled meetings within a time period
   * @param {Credentials} tokens
   * @param {String} startDateTime
   * @param {String} endDateTime
   * @return {Promise<unknown>}
   */
  getMeetings(tokens, startDateTime, endDateTime) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function(resolve, reject) {
      calendar.events.list({
        auth: oauth2Client,
        calendarId: 'primary',
        timeMin: startDateTime,
        timeMax: endDateTime,
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
   * Get a single event at a specific time
   * @param {Credentials} tokens
   * @param {String} startDateTime
   * @param {String} endDateTime
   * @return {Promise<unknown>}
   */
  getEvents(tokens, startDateTime, endDateTime = undefined) {
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

  // eslint-disable-next-line valid-jsdoc
  /**
   * Updates a meeting in user's calendar to a different time
   * @param {Credentials} tokens
   * @param {Google Calendar Event} event
   * @param {String} startDateTime
   * @param {String} endDateTime
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
          description: event.description,
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

  // eslint-disable-next-line valid-jsdoc
  /**
   * Returns an event given the eventId
   * @param {token} tokens
   * @param {string} eventId
   * @return {Promise<Google Calendar Event>}
   */
  getEventById(tokens, eventId) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function(resolve, reject) {
      calendar.events.get({
        calendarId: 'primary',
        eventId: eventId,
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
   * Updates an event's description in user's calendar
   * @param {token} tokens
   * @param {String} eventId
   * @param {String} description
   * @return {Promise<unknown>}
   */
  async setDescription(tokens, eventId, description) {
    console.log('SETDESCRIPTION***********');
    console.log(typeof (tokens));
    console.log('**************************');
    const event = await module.exports.getEventById(tokens, eventId);

    oauth2Client.setCredentials(tokens);
    // const event = getEventById(token, eventId);
    event.description = description;
    return new Promise(function(resolve, reject) {
      calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        resource: event,
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
   * Returns an event's description as it is in user's calendar
   * @param {token} tokens
   * @param {string} eventId
   * @return {Promise<string>}
   */
  getDescription(tokens, eventId) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function(resolve, reject) {
      calendar.events.get({
        calendarId: 'primary',
        eventId: eventId,
      }, function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res.data.description);
      });
    });
  },

  // eslint-disable-next-line valid-jsdoc
  /**
   * Returns a list of events given the event name
   * @param {token} tokens
   * @param {String} eventName
   * @param {String} startRangeToReschedule
   * @param {String} endRangeToReschedule
   * @return {Promise<Google Calendar Event>}
   */
  getEventByName(tokens, eventName, startRangeToReschedule, endRangeToReschedule) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function(resolve, reject) {
      calendar.events.list({
        auth: oauth2Client,
        calendarId: 'primary',
        timeMin: startRangeToReschedule,
        timeMax: endRangeToReschedule,
        singleEvents: true,
        orderBy: 'startTime',
      }, function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        const filter = res.data.items.filter((event) => event.summary === eventName);
        resolve(filter);
      });
    });
  },
};
