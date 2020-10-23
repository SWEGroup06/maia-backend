// Load User model
const User = require('../models/user.model');

// Load environment variables
require('dotenv').config();

const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI,
    {useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true});

module.exports = {
  /**
   * Hello
   * @param {number} userID
   * @param {string} email
   * @param {string} token
   */
  createNewUser: function(userID, email, token) {
    const user = new User({
      userID: userID,
      email: email,
      token: token,
    });

    user.save().then(() => console.log('Successfully created new user with email ' + email));
  },
};
