const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');

const creds = JSON.parse(process.env.CREDS);

module.exports = {
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
    const obj = {};
    if (responses && responses.length && responses[0]) {
      const res = responses[0].queryResult;
      obj.type = res.action;
      switch (res.action) {
        case 'input.meeting':
          let time = res.parameters.fields['meeting-time'];
          if (!time) {
            obj.error = 'No time found';
            break;
          }
          if (time.structValue) {
            time = time.structValue.fields;
            if (time['date_time']) {
              obj.time = time['date_time'].stringValue;
            }
            if (time['startDateTime'] && time['endDateTime']) {
              obj.startTime = time['startDateTime'].stringValue;
              obj.endTime = time['endDateTime'].stringValue;
            }
          } else {
            obj.time = time.stringValue;
          }
          break;
        default:
          break;
      }
      console.log(obj);
    } else {
      obj.error = 'No response found';
    }
    return obj;
  },
};
