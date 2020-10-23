// Load User model
const User = require('../models/user.model');

// Load environment variables
require('dotenv').config();

const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI,
    {useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true});

module.exports = {
  /**
   * TODO: Comment
   * @param {string} userID
   * @param {string} teamID
   * @param {string} token
   */
  createNewUser: function(userID, teamID, token) {
    const user = new User({
      id: {userID, teamID},
      token: token,
    });

    user.save().then(() =>
      console.log('Successfully created new user with userID ' + user.id.userID +
                  ' and teamID ' + user.id.teamID));
  },

  /**
   * TODO: Comment
   * @param {String} userID
   * @param {String} teamID
   * @return {boolean}
   */
  userExists: async function(userID, teamID) {
    return await User.exists({id: {userID: userID, teamID: teamID}});
  },

  /**
   * TODO: Comment
   * @param {String} token
   */
  tokenExists: async function(token) {
    return await User.exists({token: token});
  },
};
