const express = require('express');
const router = express.Router();

const {DateTime} = require('luxon');

const GOOGLE = require('../lib/google.js');
const DATABASE = require('../lib/database');
const MEETINGS = require('../lib/meetings.js');
const TIME = require('../lib/time.js');

// Schedule a new meeting
router.get('/schedule', async function(req, res) {
  if (!req.query.emails) {
    res.json({error: 'No emails'});
    return;
  }

  console.log('REQ************');
  console.log(req.query);
  console.log('***************');

  let title = JSON.parse(decodeURIComponent(req.query.title));
  title = title.substring(1, title.length - 1);

  const flexible = JSON.parse(decodeURIComponent(req.query.flexible));
  const duration = JSON.parse(decodeURIComponent(req.query.duration));

  let startDateTimeOfRange;
  if (!req.query.startDateTimeOfRange) {
    startDateTimeOfRange = DateTime.local();
  } else {
    startDateTimeOfRange = DateTime.fromISO(JSON.parse(decodeURIComponent(req.query.startDateTimeOfRange)));
  }

  let endDateTimeOfRange;
  if (!req.query.endDateTimeOfRange) {
    endDateTimeOfRange = startDateTimeOfRange.plus({days: 14});
  } else {
    endDateTimeOfRange = DateTime.fromISO(JSON.parse(decodeURIComponent(req.query.endDateTimeOfRange)));
  }

  if (req.query.beforeAfterKey) {
    const startEndTimes = TIME.parseBeforeAfter(JSON.parse(decodeURIComponent(req.query.beforeAfterKey)),
        startDateTimeOfRange, endDateTimeOfRange);
    startDateTimeOfRange = startEndTimes.startDateTimeOfRange;
    endDateTimeOfRange = startEndTimes.endDateTimeOfRange;
  }

  const slackEmails = JSON.parse(decodeURIComponent(req.query.emails));

  try {
    const chosenSlot = await MEETINGS.schedule(title, slackEmails, startDateTimeOfRange.toISO(),
        endDateTimeOfRange.toISO(), flexible, duration);
    console.log('-- chosen slot: ', chosenSlot, ' --');
    res.json(chosenSlot);
  } catch (error) {
    console.error(error);
    res.send({error: error.toString()});
  }
});

// Reschedule an existing meeting
router.get('/reschedule', async function(req, res) {
  // TODO: Delete these
  console.log('REQ.QUERY************');
  console.log(req.query);
  console.log(decodeURIComponent(req.query.meetingTitle));
  console.log('*********************');

  let meetingTitle = JSON.parse(decodeURIComponent(req.query.meetingTitle));
  meetingTitle = meetingTitle.substring(1, meetingTitle.length - 1);

  if (!req.query.organiserSlackEmail) {
    res.json({error: 'Organiser\'s slack email not found'});
    return;
  }

  // check if event to be reschedule has been specified
  if (!req.query.eventStartTime) {
    res.json({error: 'No event start time specified for rescheduling'});
  }

  let startDateTimeOfRange;
  let specificTimeGiven = false;
  if (!req.query.newStartDateTime) {
    startDateTimeOfRange = DateTime.local();
  } else {
    startDateTimeOfRange = DateTime.fromISO(JSON.parse(decodeURIComponent(req.query.newStartDateTime)));
    specificTimeGiven = true;
  }

  try {
    let endDateTimeOfRange;
    if (!req.query.newEndDateTime) {
      // If no end date is specified, set a default range of two weeks from the given start range date
      endDateTimeOfRange = DateTime.local().plus({days: 14});
    } else {
      endDateTimeOfRange = DateTime.fromISO(JSON.parse(decodeURIComponent(req.query.newEndDateTime)));
    }

    const currEventStartTime = JSON.parse(decodeURIComponent(req.query.eventStartTime));
    const email = JSON.parse(decodeURIComponent(req.query.organiserSlackEmail));

    if (req.query.beforeAfterKey) {
      const startEndTimes = TIME.parseBeforeAfter(JSON.parse(decodeURIComponent(req.query.beforeAfterKey)),
          startDateTimeOfRange, endDateTimeOfRange);
      startDateTimeOfRange = startEndTimes.startDateTimeOfRange;
      endDateTimeOfRange = startEndTimes.endDateTimeOfRange;
    }

    // TODO: Delete these
    console.log('PARAMETERS FOR MEETINGS.RESCHEDULE****');
    console.log(meetingTitle);
    console.log(currEventStartTime);
    console.log(email);
    console.log(startDateTimeOfRange.toISO());
    console.log(endDateTimeOfRange.toISO());
    console.log('**************************************');

    const chosenSlot = await MEETINGS.reschedule(
        currEventStartTime,
        meetingTitle,
        email,
        startDateTimeOfRange.toISO(),
        endDateTimeOfRange.toISO(),
        specificTimeGiven,
    );

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
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
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

router.get('/cancel', async function(req, res) {
  console.log('CANCEL REQ');
  console.log(req.query);

  if (!req.query.email) {
    res.json({error: 'No email found'});
  }

  try {
    const email = JSON.parse(decodeURIComponent(req.query.email));
    const organiserToken = JSON.parse(decodeURIComponent(await DATABASE.getToken(email)));

    const meetingTitle = decodeURIComponent(req.query.meetingTitle);
    const meetingDateTime = decodeURIComponent(req.query.meetingDateTime);

    let events;

    if (meetingDateTime) {
      events = await GOOGLE.getEvents(organiserToken, JSON.parse(meetingDateTime));
    } else if (meetingTitle) {
      events = await GOOGLE.getEventByName(organiserToken, JSON.parse(meetingTitle));
    }

    console.log(events);

    if (events.length > 0) {
      await GOOGLE.cancelEvent(organiserToken, events[0].id);
      res.send({success: true});
    }
  } catch (error) {
    console.error(error);
    res.send({error: error.toString()});
  }
});

module.exports = router;
