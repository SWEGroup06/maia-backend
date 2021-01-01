const express = require('express');
const router = express.Router();

const GOOGLE = require('../lib/google.js');
const DATABASE = require('../lib/database');
const MEETINGS = require('../lib/meetings.js');
const TIME = require('../lib/time.js');

// TODO: Temporary Schedule a new meeting
router.get('/sp', async function(req, res) {
  if (!req.query.slackEmails && !req.query.googleEmails) {
    res.json({error: 'No emails'});
    return;
  }

  let title = JSON.parse(decodeURIComponent(req.query.title));
  title = title.substring(1, title.length - 1);

  const duration = JSON.parse(decodeURIComponent(req.query.duration));
  const startDateRange = TIME.maintainLocalTimeZone(JSON.parse(decodeURIComponent(req.query.startDateRange)));
  const endDateRange = TIME.maintainLocalTimeZone(JSON.parse(decodeURIComponent(req.query.endDateRange)));
  const startTimeRange = TIME.maintainLocalTimeZone(JSON.parse(decodeURIComponent(req.query.startTimeRange)));
  const endTimeRange = TIME.maintainLocalTimeZone(JSON.parse(decodeURIComponent(req.query.endTimeRange)));
  const flexible = JSON.parse(decodeURIComponent(req.query.flexible));
  const dayOfWeek = JSON.parse(decodeURIComponent(req.query.dayOfWeek));
  const timeRangeSpecified = JSON.parse(decodeURIComponent(req.query.timeRangeSpecified));

  let googleEmails;
  if (req.query.googleEmails) {
    googleEmails = JSON.parse(decodeURIComponent(req.query.googleEmails));
  } else {
    const slackEmails = JSON.parse(decodeURIComponent(req.query.slackEmails));
    googleEmails = await DATABASE.getGoogleEmailsFromSlackEmails(slackEmails);
  }

  try {
    const chosenSlot = await MEETINGS.sp(
        googleEmails,
        title,
        duration,
        startDateRange,
        endDateRange,
        startTimeRange,
        endTimeRange,
        flexible,
        dayOfWeek,
        timeRangeSpecified,
    );
    res.json(chosenSlot);
  } catch (error) {
    console.error(error);
    res.send({error: error.toString()});
  }
});

// Retrieve all meetings
router.get('/meetings', async function(req, res) {
  if (!req.query.slackEmail && !req.query.googleEmail) {
    res.json({error: 'Email not found'});
    return;
  }

  try {
    let googleEmail;
    if (req.query.googleEmail) {
      googleEmail = JSON.parse(decodeURIComponent(req.query.googleEmail));
    } else {
      const slackEmail = JSON.parse(decodeURIComponent(req.query.slackEmail));
      googleEmail = await DATABASE.getGoogleEmailFromSlackEmail(slackEmail);
    }

    // Check if a user with the provided details existing in the database
    if (!await DATABASE.userExists(googleEmail)) {
      res.json({error: `${googleEmail} is not signed in`});
      return;
    }

    // Get tokens from the database
    const token = JSON.parse(await DATABASE.getTokenFromGoogleEmail(googleEmail));
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
router.get('/constraints', async function(req, res) {
  if (!req.query.slackEmail && !req.query.googleEmail) {
    res.json({error: 'Email not found'});
    return;
  }

  if (!req.query.busyTimes) {
    res.json({error: 'Busy times not found'});
  }

  if (!req.query.busyDays) {
    res.json({error: 'Busy days not found'});
    return;
  }

  try {
    let googleEmail;
    if (req.query.googleEmail) {
      googleEmail = JSON.parse(decodeURIComponent(req.query.googleEmail));
    } else {
      const slackEmail = JSON.parse(decodeURIComponent(req.query.slackEmail));
      googleEmail = await DATABASE.getGoogleEmailFromSlackEmail(slackEmail);
    }

    const days = JSON.parse(decodeURIComponent(req.query.busyDays));
    const times = JSON.parse(decodeURIComponent(req.query.busyTimes));

    await MEETINGS.setContraints(googleEmail, days, times);

    res.send({success: true});
  } catch (error) {
    console.error(error);
    res.send({error: error.toString()});
  }
});

// Cancel event
router.get('/cancel', async function(req, res) {
  if (!req.query.slackEmail && !req.query.googleEmail) {
    res.json({error: 'Email not found'});
    return;
  }

  try {
    let googleEmail;
    if (req.query.googleEmail) {
      googleEmail = JSON.parse(decodeURIComponent(req.query.googleEmail));
    } else {
      const slackEmail = JSON.parse(decodeURIComponent(req.query.slackEmail));
      googleEmail = await DATABASE.getGoogleEmailFromSlackEmail(slackEmail);
    }
    const organiserToken = JSON.parse(decodeURIComponent(await DATABASE.getTokenFromGoogleEmail(googleEmail)));

    let meetingTitle = JSON.parse(decodeURIComponent(req.query.meetingTitle));
    meetingTitle = meetingTitle.substring(1, meetingTitle.length - 1);
    const meetingDateTime = JSON.parse(decodeURIComponent(req.query.meetingDateTime));

    let events;

    if (meetingDateTime) {
      events = await GOOGLE.getEvents(organiserToken, meetingDateTime);
      if (events.length === 0 || (events.length > 0 && !TIME.compareTime(events[0].start.dateTime, meetingDateTime))) {
        res.send({error: 'No Meeting found'});
        return;
      }
    } else if (meetingTitle && meetingTitle !== '') {
      events = await GOOGLE.getEventByName(organiserToken, meetingTitle);
    } else {
      res.send({error: 'To cancel an event, please specify the event name or start time.'});
    }

    const eventTitle = events[0].summary;
    const eventDateTime = events[0].start.dateTime;

    await GOOGLE.cancelEvent(organiserToken, events[0].id);
    res.json({title: eventTitle, dateTime: eventDateTime});
  } catch (error) {
    console.error(error);
    res.send({error: error.toString()});
  }
});

// TODO: Temporary until we finish
router.get('/tp', async function(req, res) {
  if (!req.query.slackEmail && !req.query.googleEmail) {
    res.json({error: 'Email not found'});
    return;
  }

  console.log('\nTP REQ.QUERY************');
  console.log(req.query);
  console.log('**************************\n');

  // Check that either an event time or title has been specified.
  if (!req.query.oldDateTime && !req.query.oldTitle) {
    res.json({error: 'No event time or title specified for rescheduling.'});
  }

  let googleEmail;
  if (req.query.googleEmail) {
    googleEmail = JSON.parse(decodeURIComponent(req.query.googleEmail));
  } else {
    const slackEmail = JSON.parse(decodeURIComponent(req.query.slackEmail));
    googleEmail = await DATABASE.getGoogleEmailFromSlackEmail(slackEmail);
  }

  let oldTitle = JSON.parse(decodeURIComponent(req.query.oldTitle));
  oldTitle = oldTitle.substring(1, oldTitle.length - 1);

  const oldDateTime = TIME.maintainLocalTimeZone(JSON.parse(decodeURIComponent(req.query.oldDateTime)));
  const newStartDateRange = TIME.maintainLocalTimeZone(JSON.parse(decodeURIComponent(req.query.newStartDateRange)));
  const newEndDateRange = TIME.maintainLocalTimeZone(JSON.parse(decodeURIComponent(req.query.newEndDateRange)));
  const newStartTimeRange = TIME.maintainLocalTimeZone(JSON.parse(decodeURIComponent(req.query.newStartTimeRange)));
  const newEndTimeRange = TIME.maintainLocalTimeZone(JSON.parse(decodeURIComponent(req.query.newEndTimeRange)));
  const newDayOfWeek = JSON.parse(decodeURIComponent(req.query.newDayOfWeek));
  const dateRangeSpecified = JSON.parse(decodeURIComponent(req.query.dateRangeSpecified));
  const timeRangeSpecified = JSON.parse(decodeURIComponent(req.query.timeRangeSpecified));
  const flexible = JSON.parse(decodeURIComponent(req.query.flexible));

  if (!oldDateTime && !oldTitle) {
    res.json({error: 'You must specify the event title or date and time'});
    return;
  }

  try {
    const chosenSlotToRescheduleTo = await MEETINGS.tp(
        googleEmail,
        oldTitle,
        oldDateTime,
        newStartDateRange,
        newEndDateRange,
        newStartTimeRange,
        newEndTimeRange,
        newDayOfWeek,
        dateRangeSpecified,
        timeRangeSpecified,
        flexible
    );
    res.json(chosenSlotToRescheduleTo);
  } catch (error) {
    console.error(error);
    res.send({error: error.toString()});
  }
});

// TODO: Amelia + Hasan?
router.get('/preferences', async function(req, res) {
  res.sendStatus(200);
  return;
  try {
    const googleEmail = 'kpal81xd@gmail.com';
    const tokens = JSON.parse(await DATABASE.getTokenFromGoogleEmail(googleEmail));

    await MEETINGS.generatePreferences(googleEmail, tokens);

    res.send({status: 'ok'});
  } catch (err) {
    console.error(error);
    res.send({error: error.toString()});
  }
});

module.exports = router;
