const express = require('express');
const router = express.Router();

const {DateTime, Duration} = require('luxon');
const GOOGLE = require('../lib/google.js');
const DATABASE = require('../lib/database');
const SCHEDULER = require('../src/scheduler');

const NUM_CATEGORIES = 2;

router.use('/success', express.static('public'));

// Login
router.get('/login', async function(req, res) {
  if (!req.query.email) {
    res.json({error: 'No email provided'});
    return;
  }

  if (!req.query.userID) {
    res.json({error: 'No ID provided'});
    return;
  }

  try {
    const userID = JSON.parse(decodeURIComponent(req.query.userID));
    const email = JSON.parse(decodeURIComponent(req.query.email));

    // Check if a user with the provided details existing in the database
    if (await DATABASE.userExists(email)) {
      res.json({exists: true, email});
      return;
    }

    // If no details were found send URL
    await res.json({url: GOOGLE.generateAuthUrl(userID, email)});
  } catch (error) {
    console.error(error);
    res.send({error: error.toString()});
  }
});

// Google OAuth2 callback
router.get('/callback', async function(req, res) {
  if (!req.query.code) {
    await res.json({error: 'No code provided'});
    return;
  }
  if (!req.query.state) {
    await res.json({error: 'No state provided'});
    return;
  }

  try {
    const today = DateTime.local();
    const oneMonthAgo = today.minus(Duration.fromObject({days: 30}));

    const state = JSON.parse(decodeURIComponent(req.query.state));

    const tokens = await GOOGLE.getTokens(req.query.code);
    const googleEmail = await GOOGLE.getEmail(tokens);
    await DATABASE.createNewUser(state.userID, state.email, googleEmail, JSON.stringify(tokens));

    // TODO: add some form of loading screen here
    let lastMonthHist = await GOOGLE.getMeetings(tokens, oneMonthAgo.toISO(), today.toISO());
    lastMonthHist = lastMonthHist.map((e) => [e.start.dateTime, e.end.dateTime, e.summary]);
    let histFreq;
    console.log('---generating history frequencies---');
    for (let category=0; category < NUM_CATEGORIES; category++) {
      histFreq = await SCHEDULER.getUserHistory(lastMonthHist, category);
      await DATABASE.setFrequenciesByCategory(state.email, category, histFreq);
    }
    console.log('---history frequencies completed---');

    // Redirect to success page
    res.redirect('success/login.html');

    console.log('**********');
    console.log(state);

    console.log('user.id: ' + state.user.id);
    console.log('id: ' + state.id);

    // res.json({userID: state.userID, teamID: state.teamID, tokens});
  } catch (error) {
    console.error(error);
    res.send({error: error.toString()});
  }
});

// Logout (handled in slack.js)

module.exports = router;
