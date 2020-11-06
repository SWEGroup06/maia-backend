const express = require('express');
const router = express.Router();

const {Duration, DateTime} = require('luxon');

const GOOGLE = require('../lib/google.js');
const DATABASE = require('../lib/database');

const SCHEDULER = require('../src/scheduler');

// Schedule a new meeting
router.get('/schedule', async function(req, res) {
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
      googleEmails.push(await GOOGLE.getEmail(token));

      // Format busy times before pushing to array
      const data = await GOOGLE.getBusySchedule(token, startDate, endDate);
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
    await GOOGLE.createMeeting(tokens[0], `Meeting: ${today.toDateString()}`, chosenSlot.start, chosenSlot.end, googleEmails);

    res.json(chosenSlot);
  } catch (error) {
    console.error(error);
    res.send({error: error.toString()});
  }
  // res.json({TODO: 'NotImplementedYet'});
});

// Reschedule an existing meeting
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
    const events = await GOOGLE.getEvents(organiserToken, eventStartTime, eventEndTime);

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

    const organiserEmail = await GOOGLE.getEmail(organiserToken);
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
      const data = await GOOGLE.getBusySchedule(token, startDate, endDate);
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
    await GOOGLE.updateMeeting(organiserToken, originalEvent, chosenSlot.start, chosenSlot.end);
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
      res.json({error: email + ' is not signed in'});
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

module.exports = router;