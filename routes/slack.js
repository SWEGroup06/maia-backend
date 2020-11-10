const express = require('express');
const router = express.Router();

const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const {DateTime} = require('luxon');

const TIME = require('../lib/time.js');
const DATABASE = require('../lib/database.js');
const MEETINGS = require('../lib/meetings.js');

router.use('/actions', bodyParser.urlencoded({extended: true}));

const submitResponse = async function(payload, obj) {
  await fetch(payload.response_url, {
    method: 'POST',
    body: JSON.stringify(obj),
    headers: {'Content-Type': 'application/json'},
  });
  // const json = await res.json();
  // console.log(json);
};

const actionHandlers = {
  meeting_select: async function(payload, action) {
    try {
      const meetingDetails = decode(action.selected_option.value);

      const meetingStart = meetingDetails[1];
      const meetingEnd = meetingDetails[2];

      const email = await DATABASE.getEmailFromID(payload.user.id);

      MEETINGS.reschedule(meetingStart, meetingEnd, email);

      return;
    } catch (error) {
      return error.toString();
    }
  },
  constraints: async function(payload, action) {
    try {
      // Parse state
      if (!payload.state) return 'Please select a day.';
      const constraints = payload.state.values.constraints;
      const day = parseInt(constraints.day.selected_option.value);
      const startTime = new Date(`1 Jan 1970 ${ constraints.start_time.selected_time}`).toISOString();
      const endTime = new Date(`1 Jan 1970 ${ constraints.end_time.selected_time}`).toISOString();

      if (startTime == 'Invalid Date' || endTime == 'Invalid Date') {
        return 'Invalid Time';
      }

      // Dont update if the input is not the submit button
      if (action.action_id != 'submit') return;

      // Set constraint
      const email = await DATABASE.getEmailFromID(payload.user.id);
      await DATABASE.setConstraint(email, startTime, endTime, day);

      // Send response
      await submitResponse(payload, {text: 'Okay, cool! :thumbsup::skin-tone-3: I\'ll keep this in mind.'});

      return;
    } catch (error) {
      return error.toString();
    }
  },
};

// Handles Block-kit UI actions
router.post('/actions', async function(req, res) {
  const payload = JSON.parse(req.body.payload);
  if (!payload || !payload.actions || !payload.actions[0]) {
    res.sendStatus(200);
    return;
  }

  // Delegate specific tasks to action handler
  const action = payload.actions[0];
  const handler = actionHandlers[action.block_id];
  if (handler) {
    const error = await handler(payload, action);
    if (error) {
      console.log(error);
      await submitResponse(payload, {
        response_type: 'ephemeral',
        replace_original: false,
        text: error,
      });
    } else {
      res.sendStatus(200);
    }
  } else {
    res.sendStatus(200);
  }
});

router.post('/actions/meeting_options', async function(req, res) {
  const payload = JSON.parse(req.body.payload);
  const option = {options: []};
  if (payload && payload.type === 'block_suggestion') {
    if (payload.action_id === 'meeting_select') {
      console.log('get meeting options');
      const email = await DATABASE.getEmailFromID(payload.user.id);
      const meetings = await MEETINGS.getMeetings(email);
      for (let i = 0; i < meetings.length; i++) {
        const meetingName = (meetings[i][0]).substring(0, 21);

        const meetingStart = meetings[i][1];
        const startDate = new DateTime(meetings[i][1]);

        const meetingEnd = meetings[i][2];
        const endDate = new DateTime(meetings[i][2]);
        console.log(startDate.toLocaleString(startDate.TIME_24_SIMPLE));
        console.log(endDate.toLocaleString(DateTime.TIME_24_SIMPLE));

        option.options.push({
          text: {
            type: plain_text,
            text: meetingName + ' | ' + TIME.getDayOfWeekFromInt(startDate.weekday) +
            ' ' + startDate.TIME_24_SIMPLE + ' - ' +
             endDate.TIME_24_SIMPLE,
          },
          value: meetingName +'|' + meetingStart + '|' + meetingEnd,
        });
      }
    }
  }
  res.json(option);
});

/**
 * @param {number} value The slack user email.
 * @return {number} A list of meetings for the following week.
 */
function decode(value) {
  console.log('decoding');
  const meetingDetails = value.split('|');
  const meetingName = meetingDetails[0];
  const meetingStart = meetingDetails[1];
  const meetingEnd = meetingDetails[2];
  console.log(meetingName);
  console.log(meetingStart);
  console.log(meetingEnd);
  return meetingDetails;
}

module.exports = router;
