const express = require('express');
const router = express.Router();
let User = require('../models/user.model');


router.post("/", function(req, res) {
    const user = new User ({
        userID: req.body.userID,
        email: req.body.email,
        token: req.body.token
    });
    res.json(user);
    console.log("worked");
  
});

module.exports = router;