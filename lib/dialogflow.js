const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');
const TIME = require('./time.js');
const {DateTime} = require('luxon');

const creds = JSON.parse(process.env.CREDS);

const context = {
  _actionHandlers: {
    /**
     * TODO: Comment
     * @param {Object} fields
     * @return {{people: string[]}}
     */
    schedule: function(fields) {
      console.log('FIELDS**************\n');
      console.log(fields);
      console.log('**************\n');
      return ({
        ...context.parseScheduleRequest(fields),
        people: fields['people'].listValue.values.map((e) => e.stringValue),
      });
    },

    /**
     * TODO: Comment
     * @param {Object} fields
     * @return {{busyDays: null}}
     */
    constraint: function(fields) {
      return ({
        busyDays: TIME.getBusyDays(fields.dayOfWeek.listValue.values), // TODO: create array of zeroes and ones to pass
        busyTimes: TIME.getBusyTimes(fields['time-period'].listValue.values),
      });
    },

    /**
     * TODO: Comment
     * @param {Object} fields
     * @return {{}}
     */
    reschedule: function(fields) {
      console.log(context._parseTimeObj(fields['new-meeting-date']));
      return ({
        oldMeetingDate: context._parseTimeObj(fields['old-meeting-date']).time,
        newMeetingDate: context._parseTimeObj(fields['new-meeting-date']).time,
      });
    },
  },

  parseScheduleRequest(time) {
    const res = {};
    if (!time) {
      res.error = 'No time found';
      return res;
    }

    console.log('TIME******************\n');
    console.log(time);
    console.log('******************\n');

    let startTime;
    let endTime;

    if (time) {
      if (time['very-specific-meeting-time'].structValue && time['very-specific-meeting-time'].structValue.fields) {
        // Where a specific date and time is given
        // Should be in the format: { "date_time": "2020-11-12T19:00:00Z" } (DialogFlow)
        res.time = [time['very-specific-meeting-time'].structValue.fields.date_time.stringValue];
      } else if (time['specific-meeting-time'].stringValue !== '') {
        // Where a specific date is given, but not a time
        // Should be in the format: 2020-11-13T12:00:00Z (DialogFlow)
        startTime = DateTime.fromISO(time['specific-meeting-time'].stringValue).startOf('day');
        endTime = startTime.endOf('day');

        res.time = [startTime.toISO(), endTime.toISO()];
      } else if (time['meeting-time'].structValue && time['meeting-time'].structValue.fields) {
        // Where a range of dates is given, e.g. a whole week, month, etc.
        res.time = [time['meeting-time'].structValue.fields.startDate.stringValue,
          time['meeting-time'].structValue.fields.endDate.stringValue];
      }
    }

    console.log('RES******************\n');
    console.log(res);
    console.log('******************\n');

    return res;
  },

  /**
   * Understands what format time is in after DialogFlow sends it back. Possibilities include:
   *      - one single time (no date)
   *      - one single date and time
   *      - a range of times
   * @param {Object} time: passed in from DialogFlow
   * @return {Object} res: object containing either a time or a range of times
   * @private
   */
  _parseTimeObj(time) {
    const res = {};
    if (!time) {
      res.error = 'No time found';
      return res;
    }
    if (time.structValue) {
      time = time.structValue.fields;
      if (time['date_time']) {
        res.time = [time['date_time'].stringValue];
      }
      if (time['endDate'] && time['startDate']) {
        res.time = [time['startDate'].stringValue, time['endDate'].stringValue];
      }
    } else {
      res.time = [time.stringValue];
    }
    return res;
  },

  /**
   * TODO:
   * @param {String} msg: Actual raw input from the user which will be sent to DialogFlow for processing
   * @return {Object} returns an object containing the type of an action (e.g. meeting, constraint, etc.)
   * which will be sent back to front-end as response.
   */
  async sendQuery(msg) {
    // Session id
    const sessionId = uuid.v4();

    // Create a new session client
    const sessionClient = new dialogflow.SessionsClient({credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key,
    }});

    // Generate new session
    const session = sessionClient.projectAgentSessionPath(creds.project_id, sessionId);

    // Query msg
    const responses = await sessionClient.detectIntent({
      session,
      queryInput: {
        text: {
          text: msg,
          languageCode: 'en',
        },
      },
    });

    let res = {};

    // Checking if the reponses is invalid e.g null etc
    if (responses && responses.length && responses[0]) {
      const queryRes = responses[0].queryResult;
      console.log('QUERY RES', queryRes);
      res.type = queryRes.action;

      // Determine which action this is and call the relevant action handler
      const handler = context._actionHandlers[queryRes.action];
      if (handler) res = {...res, ...handler(queryRes.parameters.fields)};
    } else {
      res.error = 'No response found';
    }
    return res;
  },
};

module.exports = context;
