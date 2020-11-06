const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const router = express.Router();

const MEETINGS = require('./meetings');
const AUTH = require('./auth');
const TIME = require('./time');
const DATABASE = require('./database');
const SCHEDULER = require('../src/scheduler');

const {Duration, DateTime} = require('luxon');

// ROOT PATH
router.get('/', function(_, res) {
  res.send('This is the REST API for Maia AI calendar assistant');
});

router.use('/slack/actions', bodyParser.urlencoded({extended: true}));
router.post('/slack/actions/meeting_options', async function(req, res) {
  const slackPayload = JSON.parse(req.body.payload);
  const option =
  {
    'options': [],
  };

  if (slackPayload.type === 'block_suggestion') {
    if (slackPayload.action_id === 'meeting_select') {
      console.log('get meeting options');
      const email = await DATABASE.getEmailFromID(slackPayload.user.id);
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
          'text': {
            'type': 'plain_text',
            'text': meetingName + ' | ' + TIME.getDayOfWeekFromInt(startDate.weekday) +
            ' ' + startDate.TIME_24_SIMPLE + ' - ' +
             endDate.TIME_24_SIMPLE,
          },
          'value': meetingName +'|' + meetingStart + '|' + meetingEnd,
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

router.post('/slack/actions', async function(req, res) {
  const slackPayload = JSON.parse(req.body.payload);
  // TODO: Add error handling
  // console.log(slackPayload);

  if (slackPayload.actions[0].block_id === 'meeting_select') {
    // console.log(slackPayload);
    console.log('Meeting selected');
    const meeting = slackPayload.actions[0].selected_option;
    console.log(meeting.value + ' selected');
    const meetingDetails = decode(meeting.value);
    // const meetingDetails = AUTH.getSingleMeeting(token, eventId);
    // const meetingName = meetingDetails[i][0];
    const meetingStart = meetingDetails[1];
    const meetingEnd = meetingDetails[2];
    const email = await DATABASE.getEmailFromID(slackPayload.user.id);
    MEETINGS.reschedule(meetingStart, meetingEnd, email);

    // MEETINGS.reschedule(st)
  }
  if (slackPayload.actions[0].block_id === 'submit') {
    // Submit button has been clicked so get information
    console.log('submit clicked');
    console.log(slackPayload);
    const constraints = slackPayload.state.values.constraints;
    const day = constraints.day.selected_option.value;
    const startTime = constraints.startTime.selected_time;
    const endTime = constraints.endTime.selected_time;

    // Convert to appropriate format
    const formattedDay = TIME.getDayOfWeek(day);
    const formattedStartTime = TIME.getISOFromTime(startTime);
    const formattedEndTime = TIME.getISOFromTime(endTime);

    const email = await DATABASE.getEmailFromID(slackPayload.user.id);
    await DATABASE.setConstraint(email, formattedStartTime, formattedEndTime, formattedDay);


    fetch(slackPayload.response_url, {
      method: 'POST',
      body: JSON.stringify({text: 'Okay, cool! :thumbsup::skin-tone-3: I\'ll keep this in mind.'}),
      headers: {'Content-Type': 'application/json'},
    })
        .then((res) => res.json())
        .then((json) => console.log(json));
  }

  res.sendStatus(200);
});

// login callback
router.get('/login', async function(req, res) {
  if (!req.query.email) {
    res.json({error: 'No email provided'});
    return;
  }

  if (!req.query.userID) {
    res.json({error: 'No ID provided'});
    return;
  }

  try {
    const userID = JSON.parse(decodeURIComponent(req.query.userID));
    const email = JSON.parse(decodeURIComponent(req.query.email));

    // Check if a user with the provided details existing in the database
    if (await DATABASE.userExists(email)) {
      res.json({exists: true});
      return;
    }

    // If no details were found send URL
    await res.json({url: AUTH.generateAuthUrl(userID, email)});
  } catch (error) {
    console.error(error);
    res.send({error});
  }
});

// logout callback
router.get('/logout', async function(req, res) {
  try {
    const email = JSON.parse(decodeURIComponent(req.query.email));
    if (await DATABASE.userExists(email)) {
      await DATABASE.deleteUser(email);
      res.send({message: 'Successfully deleted account associated with email: ' + email});
    } else {
      console.log('Account with email ' + email + 'does not exist.');
      res.send({message: 'Account with email ' + email + ' does not exist.'});
    }
  } catch (error) {
    console.error(error);
    res.send({error});
  }
});

// Google auth callback
router.get('/oauth2callback', async function(req, res) {
  if (!req.query.code) {
    await res.json({error: 'No code provided'});
    return;
  }
  if (!req.query.state) {
    await res.json({error: 'No state provided'});
    return;
  }

  try {
    const state = JSON.parse(decodeURIComponent(req.query.state));

    const tokens = await AUTH.getTokens(req.query.code);
    const googleEmail = await AUTH.getEmail(tokens);
    await DATABASE.createNewUser(state.userID, state.email, googleEmail, JSON.stringify(tokens));

    // Redirect to success page
    res.redirect('success');

    console.log('**********');
    console.log(state);

    console.log('user.id: ' + state.user.id);
    console.log('id: ' + state.id);

    // res.json({userID: state.userID, teamID: state.teamID, tokens});
  } catch (error) {
    console.error(error);
    res.send({error});
  }
});

router.get('/freeslots', async function(req, res) {
  if (!req.query.email) {
    res.json({error: 'No email provided'});
    return;
  }

  if (!req.query.startDate || !req.query.endDate) {
    res.json({error: 'No time period'});
    return;
  }

  try {
    const email = JSON.parse(decodeURIComponent(req.query.email));

    // Check if a user with the provided details existing in the database
    if (!await DATABASE.userExists(email)) {
      await res.json({error: 'You are not signed in'});
      return;
    }

    // Get tokens from the database
    const tokens = JSON.parse(await DATABASE.getToken(email));

    const startDate = new Date(decodeURIComponent(req.query.startDate));
    const endDate = new Date(decodeURIComponent(req.query.endDate)).getUTCDate();

    // Get the schedule using Google's calendar API
    const data = await AUTH.getBusySchedule(tokens, startDate, endDate);

    await res.json(data);
  } catch (error) {
    console.error(error);
    res.send({error});
  }
});

router.get('/reschedule', async function(req, res) {
  // check if event to be reschedule has been specified
  if (!req.query.eventStartTime) {
    res.json({error: 'No event start time specified for rescheduling'});
  }

  if (!req.query.eventEndTime) {
    res.json({error: 'No event end time specified for rescheduling'});
  }

  if (!req.query.organiserSlackEmail) {
    res.json({error: 'Organiser\'s slack email not found'});
    return;
  }

  try {
    const constraints = [];
    const eventStartTime = new Date(JSON.parse(decodeURIComponent(req.query.eventStartTime))).toISOString();
    const eventEndTime = new Date(JSON.parse(decodeURIComponent(req.query.eventEndTime))).toISOString();
    const organiserSlackEmail = JSON.parse(decodeURIComponent(req.query.organiserSlackEmail));

    // check organiser of event (the person trying to reschedule it) is
    // signed in and check they are the organiser
    if (!await DATABASE.userExists(organiserSlackEmail)) {
      res.json({error: 'Organiser is not signed in'});
      return;
    }
    // Get organiser's token from the database
    const organiserToken = JSON.parse(await DATABASE.getToken(organiserSlackEmail));
    // get attendee emails from event
    const events = await AUTH.getEvents(organiserToken, eventStartTime, eventEndTime);

    if (!events || events.length === 0) {
      res.json({error: 'No event found to reschedule with given details'});
      return;
    }

    const originalEvent = events[0];
    let attendeeEmails = [];
    if (originalEvent.attendees) {
      attendeeEmails = originalEvent.attendees.map((person) => person.email);
    }

    // find new time for event using scheduler
    const busyTimes = [];
    const eventDuration = DateTime.fromISO(eventEndTime).diff(DateTime.fromISO(eventStartTime));

    const startDate = new Date().toISOString();
    const endDate = new Date('6 nov 2020 23:30').toISOString();

    const organiserEmail = await AUTH.getEmail(organiserToken);
    // remove organiser from attendees to avoid adding twice
    attendeeEmails.pop();
    attendeeEmails.push(organiserEmail);
    // populate busyTimes array with all attendees' schedules
    for (const email of attendeeEmails) {
      // Check if a user with the provided details existing in the database
      if (!await DATABASE.userExists(email)) {
        res.json({error: ' ' + email + ' is not signed into Maia'});
        return;
      }
      // Get tokens from the database
      const token = JSON.parse(await DATABASE.getToken(email));

      // Retrieve user constraints in format: [{startTime: ISO Date/Time String, endTime: ISO Date/Time String}],
      const weekConstraints = await DATABASE.getConstraints(email);

      // Generate constraints in format the scheduler takes in
      const generatedConstraints = SCHEDULER.generateConstraints(weekConstraints, startDate, endDate);

      if (generatedConstraints.length !== 0) {
        constraints.push(generatedConstraints);
      }

      // Format busy times before pushing to array
      const data = await AUTH.getBusySchedule(token, startDate, endDate);
      if (data) busyTimes.push(data.map((e) => [e.start, e.end]));
    }

    // Get free slots from the provided busy times
    const freeTimes = busyTimes.map((timeSlot) => SCHEDULER.getFreeSlots(timeSlot, startDate, endDate));
    // Using free times find a meeting slot and get the choice
    const chosenSlot = SCHEDULER.findMeetingSlot(freeTimes, eventDuration, constraints);

    if (!chosenSlot) {
      await res.json({error: 'No meeting slot found'});
      return;
    }

    // reschedule meeting to this new time
    await AUTH.updateMeeting(organiserToken, originalEvent, chosenSlot.start, chosenSlot.end);
    res.json(chosenSlot);
  } catch (error) {
    console.error(error);
    res.send({error});
  }
});

router.get('/meeting', async function(req, res) {
  if (!req.query.emails) {
    res.json({error: 'No emails'});
    return;
  }

  try {
    const busyTimes = [];
    const constraints = [];
    const eventDuration = Duration.fromObject({hours: 1});

    const startDate = new Date().toISOString();
    const endDate = new Date('6 nov 2020 23:30').toISOString();

    const slackEmails = JSON.parse(decodeURIComponent(req.query.emails));
    const googleEmails = [];
    const tokens = [];

    for (const email of slackEmails) {
      // Check if a user with the provided details existing in the database
      if (!await DATABASE.userExists(email)) {
        res.json({error: email + ' is not signed in'});
        return;
      }

      // Get tokens from the database
      const token = JSON.parse(await DATABASE.getToken(email));

      // Retrieve user constraints in format: [{startTime: ISO Date/Time String, endTime: ISO Date/Time String}],
      const weekConstraints = await DATABASE.getConstraints(email);

      // Generate constraints in format the scheduler takes in
      const generatedConstraints = SCHEDULER.generateConstraints(weekConstraints, startDate, endDate);

      if (generatedConstraints.length !== 0) {
        constraints.push(generatedConstraints);
      }

      tokens.push(token);

      // Get Google email for creating meeting later
      googleEmails.push(await AUTH.getEmail(token));

      // Format busy times before pushing to array
      const data = await AUTH.getBusySchedule(token, startDate, endDate);
      if (data) busyTimes.push(data.map((e) => [e.start, e.end]));
    }

    // console.log('BUSY TIMES:', busyTimes);

    // Get free slots from the provided busy times
    const freeTimes = busyTimes.map((timeSlot) => SCHEDULER.getFreeSlots(timeSlot, startDate, endDate));
    // console.log('FREE TIMES:', freeTimes);

    // Using free times find a meeting slot and get the choice
    const chosenSlot = SCHEDULER.findMeetingSlot(freeTimes, eventDuration, constraints);
    if (!chosenSlot) {
      res.json({error: 'No meeting slot found'});
      return;
    }
    // create meeting event in calendars of team members
    const today = new Date();
    await AUTH.createMeeting(tokens[0], `Meeting: ${today.toDateString()}`, chosenSlot.start, chosenSlot.end, googleEmails);

    res.json(chosenSlot);
  } catch (error) {
    console.error(error);
    res.send({error});
  }
  // res.json({TODO: 'NotImplementedYet'});
});

module.exports = router;
