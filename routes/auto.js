const express = require('express');
const router = express.Router();
const {DateTime} = require('luxon');

const GOOGLE = require('../lib/google.js');
const DATABASE = require('../lib/database.js');

router.use('/success', express.static('public'));

router.get('/accept', async function(req, res) {
  if (!req.query.email) {
    res.send({error: 'No Email'});
    return;
  }

  if (!req.query.meetingData) {
    res.send({error: 'No Meeting Data'});
    return;
  }

  try {
    // Get the event
    const email = JSON.parse(decodeURIComponent(req.query.email));
    const meetingData = JSON.parse(decodeURIComponent(req.query.meetingData));

    // Check if a user with the provided details existing in the database
    if (!await DATABASE.userExists(email)) {
      res.json({error: `${email} is not signed in`});
      return;
    }

    const token = JSON.parse(await DATABASE.getToken(email));
    const events = await GOOGLE.getEvents(token, meetingData.from.start, meetingData.from.end);

    if (!events || !events.length) {
      res.send({error: 'No Meeting found'});
      return;
    }

    // Reschedule the event
    await GOOGLE.updateMeeting(token, events[0], meetingData.to.start, meetingData.to.end);

    // Redirect to success page
    res.redirect('success/reschedule.html');
  } catch (error) {
    console.log(error);
    res.send({error: error.toString()});
  }
});

router.post('/webhook', async function(req, res) {
  const parts = req.headers['x-goog-resource-uri'].split('/');
  const email = parts[parts.length - 2];
  const data = {
    email,
    id: req.headers['x-goog-channel-id'],
    resourceId: req.headers['x-goog-resource-id'],
    timestamp: Date.now(),
  };
  console.log('WEBHOOK DATA', data);
  res.sendStatus(200);
});

// eslint-disable-next-line require-jsdoc
function parseTime(time) {
  const regex2 = /\s*([^:]*?)\s*:\s*([^:\s]*)/g;
  const t = regex2.exec(time);
  if (t === null) {
    return DateTime.fromObject({hour: parseInt(time)}).toISO();
  }
  return DateTime.fromObject({hour: parseInt(t[1]),
    minute: parseInt(t[2])}).toISO();
}
// eslint-disable-next-line require-jsdoc
function parseTimeRange(timeRange) {
  if (timeRange === 'None') {
    const now = DateTime.local().toISO();
    return {startTime: now, endTime: now};
  }
  const regex1 = /\w[^-]*/g;
  const times = timeRange.match(regex1);
  const t1 = parseTime(times[0]);
  const t2 = parseTime(times[1]);
  return {startTime: t1, endTime: t2};
}

// Handles setting up user preferences on sign up
router.post('/signup', async function(req, res) {
  console.log('...signup...', req.body);
  if (!req.body.email) {
    console.log('No email given');
    res.json({error: 'No email given'});
  }
  if (!req.body.token) {
    console.log('No token given');
    res.json({error: 'No token given'});
  }

  try {
    const email = JSON.parse(decodeURIComponent(req.body.email));
    console.log(email);
    const providedToken = JSON.parse(decodeURIComponent(req.body.token));
    console.log(providedToken);
    const answers = req.body.answers;
    const values = {};
    for (const a of answers) {
      values[a.name] = a.value;
    }
    console.log(values);
    const correctToken = await DATABASE.getToken(email);
    // console.log(correctToken);

    if (correctToken !== providedToken) {
      // res.json({error: 'incorrect token given'});
      console.log('incorrect token');
    }
    const constraints = [
      parseTimeRange(values.mon),
      parseTimeRange(values.tues),
      parseTimeRange(values.wed),
      parseTimeRange(values.thurs),
      parseTimeRange(values.fri),
      parseTimeRange(values.sat),
      parseTimeRange(values.sun),
    ];
    console.log(constraints);
    // Redirect to success page
  } catch (error) {
    console.error(error);
    res.send({error: error.toString()});
  }
});
module.exports = router;
