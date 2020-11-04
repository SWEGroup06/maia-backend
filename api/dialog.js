const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');

const creds = JSON.parse(process.env.CREDS);

const context = {
  _actionHandlers: {
    'input.meeting': function(fields) {
      return {...context._parseTimeObj(fields['meeting-time']), people: fields['people'].listValue.values.map((e) => e.stringValue)};
    },
  },
  _parseTimeObj(time) {
    const res = {};
    if (!time) {
      res.error = 'No time found';
      return res;
    }
    if (time.structValue) {
      time = time.structValue.fields;
      if (time['date_time']) {
        res.time = time['date_time'].stringValue;
      }
      if (time['startDateTime'] && time['endDateTime']) {
        res.startTime = time['startDateTime'].stringValue;
        res.endTime = time['endDateTime'].stringValue;
      }
    } else {
      res.time = time.stringValue;
    }
    return res;
  },
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
    if (responses && responses.length && responses[0]) {
      const queryRes = responses[0].queryResult;
      console.log('QUERY RES', queryRes);
      res.type = queryRes.action;

      // Determine which action this is and call the relevant action handler
      const handler = context._actionHandlers[queryRes.action];
      if (handler) res = {...handler(queryRes.parameters.fields)};
    } else {
      res.error = 'No response found';
    }
    return res;
  },
};

module.exports = context;
