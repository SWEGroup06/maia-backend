const express = require('express');
const router = express.Router();

const AUTH = require('./auth.js');
const DATABASE = require('./database');
const {schedule, busyToFree, choose} = require('../src/scheduler');
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
  if (!req.query.email) {
    res.json({error: 'No emails'});
    return;
  }

  // if (!req.query.startDate || !req.query.endDate) {
  //   res.json({error: 'No time period'});
  //   return;
  // }

  // [{"start": datetime, "end": datetime}, ...]
  // [[datetime, datetime], ...]
  try {
    const eventDuration = Duration.fromObject({hours: 1});
    const startDate = new Date().toISOString();
    const endDate = new Date('30 oct 2020').toISOString();
    // const startDate = new Date(decodeURIComponent(req.query.startDate));
    // const endDate = new Date(decodeURIComponent(req.query.endDate));
    const teamID = JSON.parse(decodeURIComponent(req.query.teamID));
    const busyTimes = [];
    // const workingHours = [];
    const userIDs = JSON.parse(decodeURIComponent(req.query.userIDs));
    console.log('user ids: ', userIDs);
    for (const u of userIDs) {
      console.log('user: ', u);
      // Check if a user with the provided details existing in the database
      if (!await DATABASE.instance.userExists(u, teamID)) {
        res.json({error: 'Someone is not signed in'});
        return;
      }

      // Get tokens from the database
      const tokens = JSON.parse(await DATABASE.instance.getToken(u, teamID));
      // const workingHoursConstraints = JSON.parse(await DATABASE.instance.getWorkingHours(u, teamID));
      // workingHours.push(workingHoursConstraints);
      // Get the schedule using Google's calendar API
      console.log('1');
      const data = await AUTH.getBusySchedule(tokens, startDate, endDate);
      console.log('2');
      busyTimes.push(data);
    }
    // pass busyTimes through busyToFree() => free times
    const freeTimes = busyTimes.map((schedule) => busyToFree(
        schedule.map((timeSlot) => [timeSlot['start'], timeSlot['end']]), startDate, endDate));
    const mutuallyFreeTimes = schedule(freeTimes, eventDuration)
        .map((timeSlot) => {
          const start = new Date(timeSlot[0]);
          const end = new Date(timeSlot[1]);
          return [start.toGMTString(), end.toGMTString()];
        });
    const chosenTimeSlot = choose(mutuallyFreeTimes);
    // pass busyTimes and workingHours through scheduler to get freeTimes
    res.json(chosenTimeSlot);
  } catch (error) {
    console.error(error);
    res.send({error});
  }
  // res.json({TODO: 'NotImplementedYet'});
});

module.exports = router;
