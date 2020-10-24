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
   * @return {boolean} success
   */
  createNewUser: function(userID, teamID, token) {
    const user = new User({
      id: {userID, teamID},
      token: token,
    });

    let success = false;

    user.save((error) => {
      if (error) {
        console.log('[Error creating new user] \n' + error);
        success = false;
      } else {
        console.log('[Created new user] ' + 'userID: ' + user.id.userID + ' teamID: ' + user.id.teamID);
        success = true;
      }
    });

    return success;
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
   * @param {String} userID
   * @param {String} teamID
   * @param {String} newToken
   * @return {boolean} Returns true if successful, false if token already exists in database.
   */
  updateToken: async function(userID, teamID, newToken) {
    if (await this.tokenExists(newToken)) {
      console.log('[Error updating token] Token already exists in database');
      return false;
    } else {
      User.findOneAndUpdate({id: {userID: userID, teamID: teamID}},
          {id: {userID: userID, teamID: teamID}, token: newToken});
      console.log('[Token updated successfully]');
      return true;
    }
  },

  /**
   * Checks if the user, identified by a User ID and Team ID, exists in the database.
   * @param {String} userID
   * @param {String} teamID
   * @return {boolean} Returns true if there exists a unique userID and teamID pair.
   */
  userExists: async function(userID, teamID) {
    return await User.exists({id: {userID: userID, teamID: teamID}});
  },

  /**
   * Checks if the given token exists for any user in the database
   * @param {String} token
   * @return {boolean} Returns true is token exists in database, false otherwise.
   */
  tokenExists: async function(token) {
    return await User.exists({token: token});
  },
};
