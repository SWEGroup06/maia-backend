const express = require('express');
const router = express.Router();

const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const {DateTime} = require('luxon');

const TIME = require('../lib/time.js');
const DATABASE = require('../lib/database.js');
const MEETINGS = require('../lib/meetings.js');
const GOOGLE = require('../lib/google.js');
const VIEW = require('../lib/view.json');


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
      const meetingDetails = decode(rescheduleOptions.meeting_select.selected_option.value);
      const meetingName = meetingDetails[0];
      const meetingStart = meetingDetails[1];
      const email = await DATABASE.getEmailFromID(payload.user.id);
      let newSlot;
      if (rescheduleOptions.startDate.selected_date && rescheduleOptions.endDate.selected_date) {
        const newStartDate = new Date(rescheduleOptions.startDate.selected_date).toISOString();
        const newEndDate = new Date(rescheduleOptions.endDate.selected_date).toISOString();
        console.log(newStartDate);
        console.log(newEndDate);
        newSlot = await MEETINGS.reschedule(meetingStart, null, email, newStartDate, newEndDate);
      } else {
        newSlot = await MEETINGS.reschedule(meetingStart, null, email, null, null);
      }
      if (newSlot) {
        const startDateTime = DateTime.fromISO(newSlot.start);
        const endDateTime = DateTime.fromISO(newSlot.end);
        const date = startDateTime.toLocaleString(DateTime.DATE_SHORT);
        const startTime = startDateTime.toLocaleString(DateTime.TIME_24_SIMPLE);
        const endTime = endDateTime.toLocaleString(DateTime.TIME_24_SIMPLE);
        await submitResponse(payload, {text: 'Okay, cool! :thumbsup::skin-tone-3: Rescheduled ' + meetingName + ' to ' + date + ' from ' + startTime + ' to ' + endTime});
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
  logout: async function(payload, action) {
    try {
      const email = JSON.parse(action.action_id);
      if (await DATABASE.userExists(email)) {
        await DATABASE.deleteUser(email);
        await submitResponse(payload, {text: `*Sign out with ${email} was successful*`});
      } else {
        const text = `*Account with email ${email} does not exist.*`;
        console.log(text);
        await submitResponse(payload, {text});
      }
      return;
    } catch (error) {
      return error.toString();
    }
  },
  confirm: async function(payload, action) {
    try {
      if (action.action_id == 'cancel') {
        const email = await DATABASE.getEmailFromID(payload.user.id);
        await MEETINGS.cancelLastBookedMeeting(email);
        const text = 'Your meeting booking has been cancelled';
        await submitResponse(payload, {text});
      } else if (action.action_id == 'edit') {
        console.log('post request to views open');
        VIEW.trigger_id = payload.trigger_id;
        const res = await fetch('https://slack.com/api/views.open', {
          method: 'POST',
          headers: {
            'Content-type': 'application/json; charset=utf-8',
            'Authorization': `Bearer xoxb-1411028050436-1449329514355-kawEgvoB7U0ku4EtR27iFILZ`,
          },
          body: JSON.stringify(VIEW),
        });
        console.log(VIEW);
        const json = await res.json();
        console.log(json);
      }
    } catch (error) {
      return error.toString();
    }
  },
  viewSubmission: async function(payload, action) {
    try {
      const values = payload.view.state.values;
      const name = values.name['name-action'].value;
      const date = values.date['datepicker-action'].selected_date;
      const startTime = values.startTime['timepicker-action'].selected_time;
      const endTime = values.endTime['timepicker-action'].selected_time;

      console.log(name);
      console.log(date);
      console.log(startTime);
      console.log(endTime);
      // await GOOGLE.updateMeeting(organiserToken, originalEvent, chosenSlot.start, chosenSlot.end);  
    } catch (error) {
      return error.toString();
    }
  },
};

// Handles Block-kit UI actions
router.post('/actions', async function(req, res) {
  const payload = JSON.parse(req.body.payload);
  console.log(payload);

  // If view submission
  let handler = null;
  let action = null;
  if (payload.type == 'view_submission') {
    console.log('view submission detected');
    handler = actionHandlers['viewSubmission'];
  } else {
    if (!payload || !payload.actions || !payload.actions[0]) {
      res.sendStatus(200);
      return;
    }
    // Delegate specific tasks to action handler
    action = payload.actions[0];
    handler = actionHandlers[action.block_id];
  }
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

// Post request for getting all meetings
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
        const meetingDetails = `${meetingName}|${meetingStart}|${meetingEnd}`;
        meetingOptions.options.push({
          text: {
            type: 'plain_text',
            text: `${meetingName} | ${weekDay} ${startTime} - ${endTime}`,
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
