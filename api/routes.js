const express = require('express');
const router = express.Router();

const AUTH = require('./auth.js');
const DATABASE = require('./database.js');

// ROOT PATH
router.get('/', function(_, res) {
  res.send('This is the REST API for Maia AI calendar assistant');
});

// login callback
router.get('/login', async function(req, res) {
  if (!req.query.userID && !req.query.teamID) {
    res.json({error: 'No userID and teamID'});
    return;
  }

  try {
    const userID = JSON.parse(decodeURIComponent(req.query.userID));
    const teamID = JSON.parse(decodeURIComponent(req.query.teamID));

    // Check if a user with the provided details existing in the database
    if (await DATABASE.instance.userExists(userID, teamID)) {
      res.json({exists: true});
      return;
    }

    // If no details were found send URL
    res.json({url: AUTH.generateAuthUrl(userID, teamID)});
  } catch (error) {
    console.error(error);
    res.send({error});
  }
});


// Google auth callback
router.get('/oauth2callback', async function(req, res) {
  if (!req.query.code) {
    res.json({error: 'No code provided'});
    return;
  }
  if (!req.query.state) {
    res.json({error: 'No state provided'});
    return;
  }

  try {
    const state = JSON.parse(decodeURIComponent(req.query.state));

    const tokens = await AUTH.getTokens(req.query.code);
    await DATABASE.instance.createNewUser(state.userID, state.teamID, JSON.stringify(tokens));

    // Redirect to success page
    res.redirect('success');
    // res.json({userID: state.userID, teamID: state.teamID, tokens});
  } catch (error) {
    console.error(error);
    res.send({error});
  }
});

router.get('/freeslots', async function(req, res) {
  if (!req.query.userID && !req.query.teamID) {
    res.json({error: 'No userID and teamID'});
    return;
  }

  if (!req.query.startDate || !req.query.endDate) {
    res.json({error: 'No time period'});
    return;
  }

  try {
    const userID = JSON.parse(decodeURIComponent(req.query.userID));
    const teamID = JSON.parse(decodeURIComponent(req.query.teamID));

    // Check if a user with the provided details existing in the database
    if (!await DATABASE.instance.userExists(userID, teamID)) {
      res.json({error: 'You are not signed in'});
      return;
    }

    // Get tokens from the database
    const tokens = JSON.parse(await DATABASE.instance.getToken(userID, teamID));

    const startDate = decodeURIComponent(req.query.startDate);
    const endDate = decodeURIComponent(req.query.endDate);

    // Get the schedule using Google's calendar API
    const data = await AUTH.getBusySchedule(tokens, startDate, endDate);

    res.json(data);
  } catch (error) {
    console.error(error);
    res.send({error});
  }
});

router.get('/meeting', function(req, res) {
  if (!req.query.userIDs && !req.query.teamID) {
    res.json({error: 'No userIDs and teamID'});
    return;
  }

  // TODO: Taariq + Ihowa

  // Check if all users are signed in

  // Parse userIDs and teamID from request


  res.json({TODO: 'NotImplementedYet'});
});

module.exports = router;
