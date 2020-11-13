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
    res.redirect('success');
  } catch (error) {
    console.log(error);
    res.send({error: error.toString()});
  }
});

module.exports = router;
