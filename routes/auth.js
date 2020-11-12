const express = require('express');
const router = express.Router();

const GOOGLE = require('../lib/google.js');
const DATABASE = require('../lib/database');

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
    const state = JSON.parse(decodeURIComponent(req.query.state));

    const tokens = await GOOGLE.getTokens(req.query.code);
    const googleEmail = await GOOGLE.getEmail(tokens);
    await DATABASE.createNewUser(state.userID, state.email, googleEmail, JSON.stringify(tokens));

    // Redirect to success page
    res.redirect('success');

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
