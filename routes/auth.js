const express = require('express');
const router = express.Router();

const GOOGLE = require('../lib/google.js');
const DATABASE = require('../lib/database.js');
const MEETINGS = require('../lib/meetings.js');

router.use('/success', express.static('public'));

// Login
router.get('/login', async function(req, res) {
  if (!req.query.googleEmail && (!!req.query.slackId + !!req.query.slackEmail) < 2) {
    res.json({error: 'No email provided'});
    return;
  }

  try {
    const data = {};
    if (req.query.googleEmail) {
      data.googleEmail = JSON.parse(decodeURIComponent(req.query.googleEmail));

      // Check if a user with the provided details existing in the database
      if (await DATABASE.userExists(data.googleEmail)) {
        res.json({exists: true, email: data.email});
        return;
      }
    } else {
      data.slackId = JSON.parse(decodeURIComponent(req.query.slackId));
      data.slackEmail = JSON.parse(decodeURIComponent(req.query.slackEmail));

      // Check if a user with the provided details existing in the database
      if (await DATABASE.userExists(data.slackEmail)) {
        const email = await DATABASE.getGoogleEmailFromSlackEmail(data.slackEmail);
        res.json({exists: true, email});
        return;
      }
    }

    // If no details were found send URL
    await res.json({url: GOOGLE.generateAuthUrl(data)});
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
    const state = JSON.parse(decodeURIComponent(req.query.state));

    const tokens = await GOOGLE.getToken(req.query.code);
    const googleEmail = await GOOGLE.getEmail(tokens);
    await DATABASE.createNewUser(googleEmail, JSON.stringify(tokens), state.slackEmail, state.slackId);

    // setTimeout(() => MEETINGS.generatePreferences(googleEmail, tokens), 0);

    // Redirect to success page
    res.redirect('success/login.html');

    // res.json({userID: state.userID, teamID: state.teamID, tokens});
  } catch (error) {
    console.error(error);
    res.send({error: error.toString()});
  }
});

// Logout (handled in slack.js)

module.exports = router;
