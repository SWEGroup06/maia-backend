const express = require('express');
const router = express.Router();

const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const TIME = require('../lib/time.js');
const DATABASE = require('../lib/database');

// Handles Block-kit UI actions
router.use('/actions', bodyParser.urlencoded({extended: true}));
router.post('/actions', async function(req, res) {
  const payload = JSON.parse(req.body.payload);

  if (payload && payload.actions && payload.actions[0] && payload.actions[0].block_id === 'submit') {
    // const constraints = payload.state.values.constraints;
    const day = payload.day.selected_option.value;
    const startTime = payload.startTime.selected_time;
    const endTime = payload.endTime.selected_time;

    // Convert to appropriate format
    const formattedDay = TIME.getDayOfWeek(day);
    const formattedStartTime = TIME.getISOFromTime(startTime);
    const formattedEndTime = TIME.getISOFromTime(endTime);

    const email = await DATABASE.getEmailFromID(slackPayload.user.id);
    await DATABASE.setConstraint(email, formattedStartTime, formattedEndTime, formattedDay);

    // Construct and submit response
    fetch(slackPayload.response_url, {
      method: 'POST',
      body: JSON.stringify({text: 'Okay, cool! :thumbsup::skin-tone-3: I\'ll keep this in mind.'}),
      headers: {'Content-Type': 'application/json'},
    }).then((res) => res.json()).then(function(json) {
      console.log(json);
    }).catch(function(error) {
      console.error(error);
    });
  }

  res.sendStatus(200);
});

module.exports = router;
