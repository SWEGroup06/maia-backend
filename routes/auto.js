const express = require('express');
const router = express.Router();

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


// Handles setting up user preferences on sign up
router.post('/signup', async function(req, res) {
  console.log('...signup...', req.body);
  if (!req.query.email) {
    console.log('No email given');
    res.json({error: 'No email given'});
  }
  if (!req.query.token) {
    console.log('No token given');
    res.json({error: 'No token given'});
  }

  try {
    const email = JSON.parse(decodeURIComponent(req.query.email));
    console.log(email);
    const providedToken = JSON.parse(decodeURIComponent(req.query.token));
    console.log(providedToken);
    const preScheduleBreaks = JSON.parse(decodeURIComponent(req.query.preScheduleBreaks));
    console.log(preScheduleBreaks);
    const correctToken = await DATABASE.getToken(email);
    console.log(correctToken);

    if (correctToken !== providedToken) {
      res.json({error: 'incorrect token given'});
    }

    // Redirect to success page
    res.redirect('./success/login.html');
  } catch (error) {
    console.error(error);
    res.send({error: error.toString()});
  }
  // if (!payload || !payload.actions || !payload.actions[0]) {
  //   res.sendStatus(200);
  //   return;
  // }
  //
  // // Delegate specific tasks to action handler
  // const action = payload.actions[0];
  // const handler = actionHandlers[action.block_id];
  // if (handler) {
  //   const error = await handler(payload, action);
  //   if (error) {
  //     console.log(error);
  //     await submitResponse(payload, {
  //       response_type: 'ephemeral',
  //       replace_original: false,
  //       text: error,
  //     });
  //   } else {
  //     res.sendStatus(200);
  //   }
  // } else {
  //   res.sendStatus(200);
  // }
  // if (!req.query.email) {
  //   res.json({error: 'No email found'});
  // }
  //
  // if (!req.query.busyTimes) {
  //   res.json({error: 'Busy times not found'});
  // }
  //
  // if (!req.query.busyDays) {
  //   res.json({error: 'Busy days not found'});
  //   return;
  // }
  //
  // try {
  //   const email = JSON.parse(decodeURIComponent(req.query.email));
  //   const days = JSON.parse(decodeURIComponent(req.query.busyDays));
  //   const times = JSON.parse(decodeURIComponent(req.query.busyTimes));
  //
  //   await MEETINGS.setContraints(email, days, times);
  //
  //   res.send({success: true});
  // } catch (error) {
  //   console.error(error);
  //   res.send({error: error.toString()});
  // }
});
module.exports = router;
