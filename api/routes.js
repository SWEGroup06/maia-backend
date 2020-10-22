const express = require('express');
const router = express.Router();

const AUTH = require('./auth.js');

// const CALENDAR = require('../lib/calendar.js');

// ROOT PATH
router.get('/', function(_, res) {
  res.send('This is the REST API for Maia AI calendar assistant');
});

// login callback
router.get('/login', function(req, res) {
  if (!req.query.userId) {
    res.json({error: 'No userID provided'});
    return;
  }

  // TODO: Check if entry exists in DB
  // const userId = JSON.parse(decodeURIComponent(req.query.userId));

  // Google auth callback
  router.get('/oauth2callback', function(req, res) {
    if (!req.query.code) {
      res.json({error: 'No code provided'});
      return;
    }

    AUTH.getTokens(req.query.code).then(function(tokens) {
      // TODO: Store UserId + tokens in DB

      // Redirect to success page
      res.redirect('success');
      // res.json({userId, tokens});
    });
  });


  res.json({url: AUTH.generateAuthUrl()});
});

router.get('/freeslots', function(req, res) {
  if (!req.query.userId && !req.query.tokens) {
    res.json({error: 'No userId or tokens'});
    return;
  }

  if (!req.query.startDate || !req.query.endDate) {
    res.json({error: 'No time period'});
    return;
  }
  const tokens = JSON.parse(decodeURIComponent(req.query.tokens));
  const startDate = JSON.parse(decodeURIComponent(req.query.startDate));
  const endDate = JSON.parse(decodeURIComponent(req.query.endDate));


  if (req.query.tokens) {
    AUTH.getBusySchedule(tokens,
        startDate,
        endDate).then(function(data) {
      res.json(data);
    });
  }

  // TODO: Check if entry exists in DB
});

module.exports = router;
