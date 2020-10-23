const express = require('express');
const router = express.Router();

const AUTH = require('./auth.js');

// ROOT PATH
router.get('/', function(_, res) {
  res.send('This is the REST API for Maia AI calendar assistant');
});

// login callback
router.get('/login', function(req, res) {
  if (!req.query.userID && !req.query.teamID) {
    res.json({error: 'No userID and teamID'});
    return;
  }

  // TODO: Check if entry exists in DB

  const userID = JSON.parse(decodeURIComponent(req.query.userID));
  const teamID = JSON.parse(decodeURIComponent(req.query.teamID));

  res.json({url: AUTH.generateAuthUrl(userID, teamID)});
});


// Google auth callback
router.get('/oauth2callback', function(req, res) {
  if (!req.query.code) {
    res.json({error: 'No code provided'});
    return;
  }
  if (!req.query.state) {
    res.json({error: 'No state provided'});
    return;
  }

  const state = JSON.parse(decodeURIComponent(req.query.state));

  AUTH.getTokens(req.query.code).then(function(tokens) {
    // TODO: Store UserId + tokens in DB

    // Redirect to success page
    // res.redirect('success');
    res.json({userID: state.userID, teamID: state.teamID, tokens});
  }).catch(function(error) {
    console.log(error);
    res.json({error});
  });
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
      console.log(error);
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
