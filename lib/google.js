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
   * @param {Credential} token - user token generated upon login
   * @return {Promise} - associated email of user
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
   * @param {Credential} tokens - user token generated upon login
   * @param {string} title - event title
   * @param {string} startDateTime - event start time
   * @param {string} endDateTime - event end time
   * @param {Array} emails - list of event attendees
   * @param {string} description - event description
   * @return {Promise} - id of created event
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
   * @param {Credential} tokens - user token generated upon login
   * @param {string} startDateTime - start of range within which the check is done
   * @param {string} endDateTime - end of range within which the check is done
   * @return {Promise} - busy schedule of user
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
   * @param {Credential} tokens - user token generated upon login
   * @param {string} startDateTime - start of range within which the check is done
   * @param {string} endDateTime - end of range within which the check is done
   * @return {Promise} - list of events found within range
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
   * @param {Credential} tokens - user token generated upon login
   * @param {string} startDateTime - start of range within which the check is done
   * @param {string} endDateTime - end of range within which the check is done
   * @return {Promise} - first event object found within range
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
   * @param {Credential} tokens - user token generated upon login
   * @param {object} event - evebt being updated
   * @param {string} startDateTime - new start time for event
   * @param {string} endDateTime - new end time for event
   * @param {string} title - new title for event
   * @return {Promise} - event id
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
   * @param {token} tokens - user token generated upon login
   * @param {string} eventId - event id
   * @return {Promise<object>} - event object
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
   * @param {token} tokens - user token generated upon login
   * @param {object} event - event object
   * @param {string} description - new description for event object
   * @return {Promise} - id of event
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
   * @param {token} tokens - user token generated upon login
   * @param {string} eventId - id of event being searched for
   * @return {Promise<string>} - description of event being searched for
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
   * @param {token} tokens - user token generated upon login
   * @param {string} eventName - name of event being searched
   * @param {string} startRangeToReschedule - start of range within which the check is done
   * @param {string} endRangeToReschedule - end of range within which the check is done
   * @return {Promise} - event associated with eventName param
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
   * @param {token} tokens - user token generated upon login
   * @param {string} eventId - if of event to be cancelled
   * @return {Promise} - error / success response
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
   * @param {Credential} token - user token generated upon login
   * @return {Promise} - error / success response
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
