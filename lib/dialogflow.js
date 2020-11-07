const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');
const TIME = require('./time.js');

const creds = JSON.parse(process.env.CREDS);

const context = {
  _actionHandlers: {
    /**
     * TODO: Comment
     * @param {Object} fields
     * @return {{people: string[]}}
     */
    meeting: function(fields) {
      return ({
        ...context._parseTimeObj(fields['meeting-time']),
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
