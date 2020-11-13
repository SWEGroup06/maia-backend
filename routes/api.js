const express = require('express');
const router = express.Router();

const {DateTime} = require('luxon');

const GOOGLE = require('../lib/google.js');
const DATABASE = require('../lib/database');
const MEETINGS = require('../lib/meetings.js');

// Schedule a new meeting
router.get('/schedule', async function(req, res) {
  if (!req.query.emails) {
    res.json({error: 'No emails'});
    return;
  }

  let startDate;
  if (!req.query.startDateTimeOfRange) {
    startDate = new Date().toISOString();
  } else {
    startDate = JSON.parse(decodeURIComponent(req.query.startDateTimeOfRange));
  }

  let endDate;
  if (!req.query.endDateTimeOfRange) {
    endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDay() + 14).toISOString();
  } else {
    endDate = JSON.parse(decodeURIComponent(req.query.endDateTimeOfRange));
  }

  const slackEmails = JSON.parse(decodeURIComponent(req.query.emails));

  try {
    const chosenSlot = await MEETINGS.schedule(slackEmails, startDate, endDate);
    res.json(chosenSlot);
  } catch (error) {
    console.error(error);
    res.send({error: error.toString()});
  }
});

// Reschedule an existing meeting
router.get('/reschedule', async function(req, res) {
  if (!req.query.organiserSlackEmail) {
    res.json({error: 'Organiser\'s slack email not found'});
    return;
  }

  // check if event to be reschedule has been specified
  if (!req.query.eventStartTime) {
    res.json({error: 'No event start time specified for rescheduling'});
  }

  let startOfRangeToRescheduleTo;
  if (!req.query.newStartDateTime) {
    startOfRangeToRescheduleTo = DateTime.local();
  } else {
    startOfRangeToRescheduleTo = JSON.parse(decodeURIComponent(req.query.newStartDateTime));
  }

  let endOfRangeToRescheduleTo;
  if (!req.query.newEndDateTime) {
    endOfRangeToRescheduleTo = DateTime.local(startOfRangeToRescheduleTo.getFullYear(), startOfRangeToRescheduleTo.getMonth(), startOfRangeToRescheduleTo.getDay() + 14).toISOString();
  } else {
    endOfRangeToRescheduleTo = JSON.parse(decodeURIComponent(req.query.newEndDateTime));
  }

  try {
    chosenSlot = await MEETINGS.reschedule(eventStartTime, organiserSlackEmail, startOfRangeToRescheduleTo, endOfRangeToRescheduleTo);

    res.json(chosenSlot);
  } catch (error) {
    console.error(error);
    res.send({error: error.toString()});
  }
});

// Retrieve all meetings
router.get('/meetings', async function(req, res) {
  if (!req.query.email) {
    res.json({error: 'No emails'});
    return;
  }

  try {
    const email = JSON.parse(decodeURIComponent(req.query.email));

    // Check if a user with the provided details existing in the database
    if (!await DATABASE.userExists(email)) {
      res.json({error: `${email} is not signed in`});
      return;
    }

    // Get tokens from the database
    const token = JSON.parse(await DATABASE.getToken(email));
    const today = new Date();
    // End date in one week for now
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()+7);
    const events = await GOOGLE.getMeetings(token, today.toISOString(), endDate.toISOString());

    if (!events || events.length === 0) {
      res.json({error: 'No event found in time frame'});
      return;
    }
    // could possible have the same summary multiple times
    const eventDict = [];
    events.map((event) => [event.summary, event.start.date, event.end.date]);

    res.json(eventDict);
  } catch (error) {
    console.error(error);
    res.send({error: error.toString()});
  }
});

// Add constraints
router.get('/constraint', async function(req, res) {
  if (!req.query.email) {
    res.json({error: 'No email found'});
  }

  if (!req.query.busyTimes) {
    res.json({error: 'Busy times not found'});
  }

  if (!req.query.busyDays) {
    res.json({error: 'Busy days not found'});
    return;
  }

  try {
    const email = JSON.parse(decodeURIComponent(req.query.email));
    const days = JSON.parse(decodeURIComponent(req.query.busyDays));
    const times = JSON.parse(decodeURIComponent(req.query.busyTimes));

    await MEETINGS.setContraints(email, days, times);

    res.send({success: true});
  } catch (error) {
    console.error(error);
    res.send({error: error.toString()});
  }
});

module.exports = router;
