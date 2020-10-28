const express = require('express');
const router = express.Router();

const AUTH = require('./auth.js');
const DATABASE = require('./database');
const SCHEDULER = require('../src/scheduler');
const TIME = require('./time.js')
const {Duration} = require('luxon');

// ROOT PATH
router.get('/', function(_, res) {
  res.send('This is the REST API for Maia AI calendar assistant');
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
    await DATABASE.createNewUser(state.email, JSON.stringify(tokens));

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

router.get('/meeting', async function(req, res) {
  if (!req.query.emails) {
    res.json({error: 'No emails'});
    return;
  }

  try {
    const busyTimes = [];
    const eventDuration = Duration.fromObject({hours: 1});

    const startDate = new Date().toISOString();
    const endDate = new Date('30 oct 2020').toISOString();

    const emails = JSON.parse(decodeURIComponent(req.query.emails));
    const tokens = [];

    for (const email of emails) {
      // Check if a user with the provided details existing in the database
      if (!await DATABASE.userExists(email)) {
        res.json({error: 'Someone is not signed in'});
        return;
      }

      // Get tokens from the database
      const token = JSON.parse(await DATABASE.getToken(email));
      tokens.push(token);

      // Format busy times before pushing to array
      const data = await AUTH.getBusySchedule(token, startDate, endDate);
      if (data) busyTimes.push(data.map((e) => [e.start, e.end]));
    }

    // console.log('BUSY TIMES:', busyTimes);

    // Get free slots from the provided busy times
    const freeTimes = busyTimes.map((timeSlot) => SCHEDULER.getFreeSlots(timeSlot, startDate, endDate));
    // console.log('FREE TIMES:', freeTimes);

    // Using free times find a meeting slot and get the choice
    const chosenSlot = SCHEDULER.findMeetingSlot(freeTimes, eventDuration);

    // create meeeting event in calendars of team members
    const today = new Date();
    await AUTH.createMeeting(tokens[0], `Meeting: ${today.toDateString()}`, chosenSlot.start, chosenSlot.end, emails);

    // console.log(await AUTH.getEmail(tokens[0]));

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
    res.json({error: 'No email provided'});
    return;
  }
  if (!req.query.endTime) {
    res.json({error: 'No email provided'});
    return;
  }
  if (!req.query.dayOfWeek) {
    res.json({error: 'No email provided'});
    return;
  }

  try {
    const email = JSON.parse(decodeURIComponent(req.query.email));
    const startTime = getTimeFromISO(JSON.parse(decodeURIComponent(req.query.startTime)));
    const endTime = getTimeFromISO(JSON.parse(decodeURIComponent(req.query.endTime)));
    const dayOfWeek = JSON.parse(decodeURIComponent(req.query.dayOfWeek));


    // Check if a user with the provided details existing in the database
    if (!await DATABASE.userExists(email)) {
      await res.json({error: 'You are not signed in'});
      return;
    }

    DATABASE.setConstraint(email,startTime, endTime, dayOfWeek);

    await res.json(data);
  } catch (error) {
    console.error(error);
    res.send({error});
  }
});

module.exports = router;
