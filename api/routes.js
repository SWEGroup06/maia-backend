const express = require('express');
const router = express.Router();

const AUTH = require('./auth.js');
const TIME = require('./time.js');
const DATABASE = require('./database');
const SCHEDULER = require('../src/scheduler');

const {Duration, DateTime} = require('luxon');

// ROOT PATH
router.get('/', function(_, res) {
  res.send('This is the REST API for Maia AI calendar assistant');
});


router.post('/ui', async function(req, res) {
  try {
    res.send('POST request to the homepage');
    console.log(req.body.payload);
    return res.send();
  } catch (error) {
    console.error(error);
  }
});

// login callback
router.get('/login', async function(req, res) {
  if (!req.query.email) {
    res.json({error: 'No email provided'});
    return;
  }

  try {
    const email = JSON.parse(decodeURIComponent(req.query.email));

    // Check if a user with the provided details existing in the database
    if (await DATABASE.userExists(email)) {
      res.json({exists: true});
      return;
    }

    // If no details were found send URL
    await res.json({url: AUTH.generateAuthUrl(email)});
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

    await DATABASE.createNewUser(state.email, googleEmail, JSON.stringify(tokens));

    // Redirect to success page
    res.redirect('success');
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
    const endDate = new Date('30 Nov 2020').toISOString();

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
      await res.json({error: 'No free time to assign'});
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
    const endDate = new Date('30 nov 2020').toISOString();

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

router.get('/constraint', async function(req, res) {
  if (!req.query.email) {
    res.json({error: 'No email provided'});
    return;
  }

  if (!req.query.startTime) {
    res.json({error: 'No start time provided'});
    return;
  }

  if (!req.query.endTime) {
    res.json({error: 'No end time provided'});
    return;
  }

  if (!req.query.dayOfWeek) {
    await res.json({error: 'No day of week provided'});
    return;
  }

  try {
    const email = JSON.parse(decodeURIComponent(req.query.email));
    let startTime = JSON.parse(decodeURIComponent(req.query.startTime));
    let endTime = JSON.parse(decodeURIComponent(req.query.endTime));
    const dayOfWeek = JSON.parse(decodeURIComponent(req.query.dayOfWeek));

    // Check if a user with the provided details existing in the database
    if (!await DATABASE.userExists(email)) {
      await res.json({error: 'You are not signed in'});
      return;
    }
    startTime = TIME.parseTime(startTime);
    endTime = TIME.parseTime(endTime);

    await DATABASE.setConstraint(email, startTime, endTime, TIME.getDayOfWeek(dayOfWeek));
    // await res.json(data);
  } catch (error) {
    console.error(error);
    res.send({error});
  }
});

module.exports = router;
