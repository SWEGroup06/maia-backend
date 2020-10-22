const express = require('express');
const router = express.Router();

const AUTH = require('./auth.js');

// ROOT PATH
router.get('/', function(_, res) {
  res.send('This is the REST API for Maia AI calendar assistant');
});

// API LOGIN CALLBACK
router.get('/api/login', function(req, res) {
  if (!req.query.userId) {
    res.json({error: 'No userID provided'});
    return;
  }

  const userId = JSON.parse(decodeURIComponent(req.query.userId));

  // GOOGLE AUTH CALLBACK
  router.get('/oauth2callback', function(req, res) {
    res.json({userId, code: req.query.code});
  });


  res.json({url: AUTH.generateAuthUrl()});
});

module.exports = router;
