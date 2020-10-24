// Load User model
const User = require('../models/user.model');

// Load environment variables
require('dotenv').config();

const mongoose = require('mongoose');

// Opens the mongoose connection given the Mongo URI
mongoose.connect(process.env.MONGO_URI,
    {useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true});

/*
 * TODO List:
 *  - Add constraints stuff
 *  - Do some further checking in each function
 *  - Make void functions return a boolean according to success
 *  - Return console logs for each function
 */


module.exports = {
  /**
   * Creates a new user in the database, uniquely identified by User ID, Team ID and token
   * @param {string} userID
   * @param {string} teamID
   * @param {string} token
   */
  createNewUser: function(userID, teamID, token) {
    const user = new User({
      id: {userID, teamID},
      token: token,
    });

    user.save((error) => {
      if (error) {
        console.log('[Error creating new user] \n' + error);
        return false;
      } else {
        console.log('[Created new user] ' + 'userID: ' + user.id.userID + ' teamID: ' + user.id.teamID);
        return true;
      }
    });
  },

  /**
   * Retrieves the token of a user given the User ID and Team ID which uniquely
   * identifies a user.
   * @param {String} userID
   * @param {String} teamID
   * @return {String} If token exists return it in String format, otherwise returns null.
   */
  getToken: async function(userID, teamID) {
    return User.findOne({id: {userID: userID, teamID: teamID}}).then((user) => {
      if (user == null) {
        return null;
      } else {
        return user.token;
      }
    }).catch((err) => {
      console.log(err);
    });
  },

  /**
   * Updates a user's token value with a new token, given the User ID and Team ID
   * which uniquely identifies a user.
   * TODO: Ensure that newToken does not already exist in the database.
   * @param {String} userID
   * @param {String} teamID
   * @param {String} newToken
   */
  updateToken: async function(userID, teamID, newToken) {
    return User.findOneAndUpdate({id: {userID: userID, teamID: teamID}},
        {id: {userID: userID, teamID: teamID}, token: newToken});
  },

  /**
   * Checks if the user, identified by a User ID and Team ID, exists in the database.
   * @param {String} userID
   * @param {String} teamID
   * @return {boolean}
   */
  userExists: async function(userID, teamID) {
    return await User.exists({id: {userID: userID, teamID: teamID}});
  },

  /**
   * Checks if the given token exists for any user in the database
   * @param {String} token
   */
  tokenExists: async function(token) {
    return await User.exists({token: token});
  },
};
