const { google } = require("googleapis");
const calendar = google.calendar("v3");
const people = google.people("v1");

const CONFIG = require("../config.js");
const TIME = require("./time.js");
const { DateTime } = require("luxon");

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  CONFIG.serverURL + "/auth/callback"
);

const TODAY = DateTime.local();
const TODAY_PLUS_ONE_MONTH = TODAY.plus({ months: 1 });

module.exports = {
  generateAuthUrl(data) {
    return oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/plus.me",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/calendar",
      ],
      state: encodeURIComponent(JSON.stringify(data)),
    });
  },
  getToken(code) {
    return new Promise(function (resolve, reject) {
      oauth2Client.getToken(code, function (err, tokens) {
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
   *
   * @param {Credential} token - TODO: Ihowa
   * @return {Promise} - TODO: Ihowa
   */
  getEmail(token) {
    oauth2Client.setCredentials(token);
    return new Promise(function (resolve, reject) {
      people.people.get(
        {
          auth: oauth2Client,
          personFields: "emailAddresses",
          resourceName: "people/me",
        },
        function (err, res) {
          if (err) {
            reject(err);
            return;
          }
          resolve(res.data.emailAddresses[0].value);
        }
      );
    });
  },

  /**
   * Create meeting in user's calendar with associated attendees
   *
   * @param {Credential} tokens - TODO: Ihowa
   * @param {string} title - TODO: Ihowa
   * @param {string} startDateTime - TODO: Ihowa
   * @param {string} endDateTime - TODO: Ihowa
   * @param {Array} emails - TODO: Ihowa
   * @param {string} description - TODO: Ihowa
   * @return {Promise} - TODO: Ihowa
   */
  createMeeting(
    tokens,
    title,
    startDateTime,
    endDateTime,
    emails,
    description
  ) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function (resolve, reject) {
      calendar.events.insert(
        {
          auth: oauth2Client,
          calendarId: "primary",
          resource: {
            summary: title,
            description: description,
            start: { dateTime: startDateTime },
            end: { dateTime: endDateTime },
            attendees: emails.map((email) => {
              return { email };
            }),
          },
        },
        function (err, res) {
          if (err) {
            reject(err);
            return;
          }
          resolve(res);
        }
      );
    });
  },

  /**
   * Gets busy schedule of user for scheduling purposes
   *
   * @param {Credential} tokens - TODO: Ihowa
   * @param {string} startDateTime - TODO: Ihowa
   * @param {string} endDateTime - TODO: Ihowa
   * @return {Promise} - TODO: Ihowa
   */
  getBusySchedule(tokens, startDateTime, endDateTime) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function (resolve, reject) {
      calendar.freebusy.query(
        {
          auth: oauth2Client,
          resource: {
            items: [{ id: "primary" }],
            timeMin: startDateTime,
            timeMax: endDateTime,
          },
        },
        function (err, res) {
          if (err) {
            reject(err);
            return;
          }
          resolve(res.data.calendars.primary.busy);
        }
      );
    });
  },

  /**
   * Get all scheduled meetings within a time period
   *
   * @param {Credential} tokens - TODO: Ihowa
   * @param {string} startDateTime - TODO: Ihowa
   * @param {string} endDateTime - TODO: Ihowa
   * @return {Promise} - TODO: Ihowa
   */
  getMeetings(tokens, startDateTime, endDateTime) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function (resolve, reject) {
      calendar.events.list(
        {
          auth: oauth2Client,
          calendarId: "primary",
          timeMin: startDateTime,
          timeMax: endDateTime,
          singleEvents: true,
          orderBy: "startTime",
        },
        function (err, res) {
          if (err) {
            reject(err);
            return;
          }
          resolve(res.data.items);
        }
      );
    });
  },

  async getEvent(tokens, startDateTime, endDateTime = undefined) {
    const events = await this.getEvents(tokens, startDateTime, endDateTime);
    if (
      events.length === 0 ||
      (events.length > 0 &&
        !TIME.compareTime(events[0].start.dateTime, startDateTime))
    ) {
      return null;
    }
    return events[0];
  },

  /**
   * Get a single event at a specific time
   *
   * @param {Credential} tokens - TODO: Ihowa
   * @param {string} startDateTime - TODO: Ihowa
   * @param {string} endDateTime - TODO: Ihowa
   * @return {Promise} - TODO: Ihowa
   */
  getEvents(tokens, startDateTime, endDateTime = undefined) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function (resolve, reject) {
      calendar.events.list(
        {
          auth: oauth2Client,
          calendarId: "primary",
          timeMin: startDateTime,
          timeMax: endDateTime,
          maxResults: 1,
          singleEvents: true,
          orderBy: "startTime",
        },
        function (err, res) {
          if (err) {
            reject(err);
            return;
          }
          resolve(res.data.items);
        }
      );
    });
  },

  /**
   * Updates a meeting in user's calendar to a different time
   *
   * @param {Credential} tokens - TODO: Ihowa
   * @param {object} event - TODO: Ihowa
   * @param {string} startDateTime - TODO: Ihowa
   * @param {string} endDateTime - TODO: Ihowa
   * @param {string} title - TODO: Ihowa
   * @return {Promise} - TODO: Ihowa
   */
  updateMeeting(tokens, event, startDateTime, endDateTime, title) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function (resolve, reject) {
      calendar.events.update(
        {
          auth: oauth2Client,
          calendarId: "primary",
          eventId: event.id,
          event: event,
          resource: {
            summary: event.summary,
            description: event.description,
            start: { dateTime: startDateTime },
            end: { dateTime: endDateTime },
            attendees: event.attendees,
          },
        },
        function (err, res) {
          if (err) {
            reject(err);
            return;
          }
          resolve(res);
        }
      );
    });
  },

  /**
   * Returns an event given the eventId
   *
   * @param {token} tokens - TODO: Ihowa
   * @param {string} eventId - TODO: Ihowa
   * @return {Promise<object>} - TODO: Ihowa
   */
  getEventById(tokens, eventId) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function (resolve, reject) {
      calendar.events.get(
        {
          auth: oauth2Client,
          calendarId: "primary",
          eventId: eventId,
        },
        function (err, res) {
          if (err) {
            reject(err);
            return;
          }
          resolve(res);
        }
      );
    });
  },

  /**
   * Updates an event's description in user's calendar
   *
   * @param {token} tokens - TODO: Ihowa
   * @param {object} event - TODO: Ihowa
   * @param {string} description - TODO: Ihowa
   * @return {Promise} - TODO: Ihowa
   */
  setDescription(tokens, event, description) {
    // const event = await module.exports.getEventById(tokens, eventId);
    oauth2Client.setCredentials(tokens);
    // const event = getEventById(token, eventId);
    event.description = description;
    return new Promise(function (resolve, reject) {
      calendar.events.patch(
        {
          auth: oauth2Client,
          calendarId: "primary",
          eventId: event.id,
          resource: event,
        },
        function (err, res) {
          if (err) {
            reject(err);
            return;
          }
          resolve(res);
        }
      );
    });
  },

  /**
   * Returns an event's description as it is in user's calendar
   *
   * @param {token} tokens - TODO: Ihowa
   * @param {string} eventId - TODO: Ihowa
   * @return {Promise<string>} - TODO: Ihowa
   */
  getDescription(tokens, eventId) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function (resolve, reject) {
      calendar.events.get(
        {
          auth: oauth2Client,
          calendarId: "primary",
          eventId: eventId,
        },
        function (err, res) {
          if (err) {
            reject(err);
            return;
          }
          resolve(res.data.description);
        }
      );
    });
  },

  /**
   * Returns a list of events given the event name
   *
   * @param {token} tokens - TODO: Ihowa
   * @param {string} eventName - TODO: Ihowa
   * @param {string} startRangeToReschedule - TODO: Ihowa
   * @param {string} endRangeToReschedule - TODO: Ihowa
   * @return {Promise} - TODO: Ihowa
   */
  getEventByName(
    tokens,
    eventName,
    startRangeToReschedule = TODAY.toISO(),
    endRangeToReschedule = TODAY_PLUS_ONE_MONTH.toISO()
  ) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function (resolve, reject) {
      calendar.events.list(
        {
          auth: oauth2Client,
          calendarId: "primary",
          timeMin: startRangeToReschedule,
          timeMax: endRangeToReschedule,
          singleEvents: true,
          orderBy: "startTime",
        },
        function (err, res) {
          if (err) {
            reject(err);
            return;
          }
          const filter = res.data.items.filter(
            (event) => event.summary === eventName
          );
          resolve(filter);
        }
      );
    });
  },

  /**
   * Cancels an event in user's calendar
   *
   * @param {token} tokens - TODO: Ihowa
   * @param {string} eventId - TODO: Ihowa
   * @return {Promise} - TODO: Ihowa
   */
  cancelEvent(tokens, eventId) {
    oauth2Client.setCredentials(tokens);
    return new Promise(function (resolve, reject) {
      calendar.events.delete(
        {
          auth: oauth2Client,
          calendarId: "primary",
          eventId: eventId,
        },
        function (err, res) {
          if (err) {
            reject(err);
            return;
          }
          resolve(res);
        }
      );
    });
  },

  /**
   * Clears the primary calendar of the user with the specified token.
   *
   * @param {Credential} token - TODO: Ihowa
   * @return {Promise} - TODO: Ihowa
   */
  clearCalendar(token) {
    oauth2Client.setCredentials(token);
    return new Promise(function (resolve, reject) {
      calendar.calendars.clear(
        {
          auth: oauth2Client,
          calendarId: "primary",
        },
        (err, res) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(res);
        }
      );
    });
  },
};
