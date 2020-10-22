const express = require('express');
const router = express.Router();

const AUTH = require('./auth.js');

const CALENDAR = require('../lib/calendar.js');

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

  const userId = JSON.parse(decodeURIComponent(req.query.userId));

  // Google auth callback
  router.get('/oauth2callback', function(req, res) {
    if (!req.query.code) {
      res.json({error: 'No code provided'});
      return;
    }

    AUTH.getTokens(req.query.code).then(function(tokens) {
      // TODO: Ihowa
      CALENDAR.getCalendarData(tokens);

      // Temporary response
      res.json({userId, tokens});
    });
  });


  res.json({url: AUTH.generateAuthUrl()});
});

module.exports = router;
