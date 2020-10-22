const express = require('express');
const router = express.Router();
const User = require('../models/user.model');

router.post('/', async function(req, res) {
  const user = new User({
    userID: req.body.userID,
    email: req.body.email,
    token: req.body.token,
    versionKey: false,
  });

  try {
    const savedPost = await user.save();
    res.json(savedPost);
  } catch (err) {
    res.json({message: err});
  }

  console.log('POST Request Successful');
});

module.exports = router;
