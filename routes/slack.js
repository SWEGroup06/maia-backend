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
  reschedule_button: async function(payload, action) {
    try {
      if (!payload.state) {
        return 'Please select a meeting';
      }
      const rescheduleOptions = payload.state.values.reschedule_options;
      console.log(rescheduleOptions);
      if (rescheduleOptions.start_time.selected_time && rescheduleOptions.end_time.selected_time) {
        console.log('times selected');
        const newStartTime = new Date(`1 Jan 1970 ${ rescheduleOptions.start_time.selected_time}`).toISOString();
        const newEndTime = new Date(`1 Jan 1970 ${ rescheduleOptions.end_time.selected_time}`).toISOString();
        console.log(newStartTime);
        console.log(newEndTime);
      } else {
        console.log('no times selected');
        console.log(rescheduleOptions.meeting_select);
        const meetingDetails = decode(rescheduleOptions.meeting_select.selected_option.value);
        const meetingName = meetingDetails[0];
        const meetingStart = meetingDetails[1];
        const meetingEnd = meetingDetails[2];
        const email = await DATABASE.getEmailFromID(payload.user.id);
        const newSlot = await MEETINGS.reschedule(meetingStart, meetingEnd, null, null, email);
        const startDateTime = DateTime.fromISO(newSlot.start);
        const endDateTime = DateTime.fromISO(newSlot.end);
        const startTime = startDateTime.toLocaleString(DateTime.TIME_24_SIMPLE);
        const endTime = endDateTime.toLocaleString(DateTime.TIME_24_SIMPLE);
        const weekDay = TIME.getDayOfWeekFromInt(startDateTime.weekday);
        console.log(startDateTime.weekday);
        await submitResponse(payload, {text: 'Okay, cool! :thumbsup::skin-tone-3: Rescheduled ' + meetingName + ' to ' + weekDay + ' from ' + startTime + ' to ' + endTime});
      }
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
  const meetingOptions = {options: []};
  if (payload && payload.type === 'block_suggestion') {
    if (payload.action_id === 'meeting_select') {
      const email = await DATABASE.getEmailFromID(payload.user.id);
      const meetings = await MEETINGS.getMeetings(email);
      if (!meetings) {
        return;
      }
      for (let i = 0; i < meetings.length; i++) {
        const name = meetings[i][0];
        const meetingName = name.substring(0, Math.min(18, name.length));
        const meetingStart = meetings[i][1];
        const startDateTime = DateTime.fromISO(meetingStart);
        const meetingEnd = meetings[i][2];
        const endDateTime = DateTime.fromISO(meetingEnd);
        const startTime = startDateTime.toLocaleString(DateTime.TIME_24_SIMPLE);
        const endTime = endDateTime.toLocaleString(DateTime.TIME_24_SIMPLE);
        const weekDay = TIME.getDayOfWeekFromInt(startDateTime.weekday);
        const meetingDetails = meetingName +'|' + meetingStart + '|' + meetingEnd;
        meetingOptions.options.push({
          text: {
            type: 'plain_text',
            text: meetingName + ' | ' + weekDay + ' ' + startTime + ' - ' + endTime,
          },
          value: meetingDetails,
        });
      }
    }
  }
  res.json(meetingOptions);
});

/**
 * @param {number} value The string to be decoded
 * @return {number} The decoded string split at '|' characters
 */
function decode(value) {
  const meetingDetails = value.split('|');
  return meetingDetails;
}

module.exports = router;
