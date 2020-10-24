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
    const error = await DATABASE.instance.createNewUser(state.userID, state.teamID, tokens);

    if (error) {
      res.json({error});
      return;
    }
    // Redirect to success page
    res.redirect('success');
    // res.json({userID: state.userID, teamID: state.teamID, tokens});
  } catch (error) {
    console.error(error);
    res.send({error});
  }
});

router.get('/freeslots', function(req, res) {
  if (!req.query.userID && !req.query.teamID) {
    res.json({error: 'No userID and teamID'});
    return;
  }

  if (!req.query.startDate || !req.query.endDate) {
    res.json({error: 'No time period'});
    return;
  }

  const startDate = decodeURIComponent(req.query.startDate);
  const endDate = decodeURIComponent(req.query.endDate);

  if (req.query.tokens) {
    const tokens = JSON.parse(decodeURIComponent(req.query.tokens));
    AUTH.getBusySchedule(tokens, startDate, endDate).then(function(data) {
      res.json(data);
    }).catch(function(error) {
      console.error(error);
      res.json({error});
    });
  } else {
    res.json({TODO: 'NotImplementedYet'});
  }

  // TODO: Check if entry exists in DB
});

router.get('/meeting', function(req, res) {
  if (!req.query.userIDs && !req.query.teamID) {
    res.json({error: 'No userIDs and teamID'});
    return;
  }

  res.json({TODO: 'NotImplementedYet'});
});

module.exports = router;
