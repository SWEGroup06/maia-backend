// Load User model
const User = require('../models/user.model');

const mongoose = require('mongoose');

/*
 * TODO List:
 *  - Add constraints stuff
 *  - Do some further checking in each function
 *  - Make void functions return a boolean according to success
 *  - Return console logs for each function
 */


module.exports = {
  /**
   *
   * @return {Promise<void>}
   */
  getDatabaseConnection: async function() {
    try {
      await mongoose.connect(process.env.MONGO_URI,
          {useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true});
      console.log('Connection to DB Successful');
    } catch (error) {
      console.log('Connection to DB unsuccessful');
      console.error('Details:\n' + error);
    }
  },

  /**
   * Creates a new user in the database, uniquely identified by User ID, Team ID and token
   * @param {string} email
   * @param {string} token
   * @return {boolean} success
   */
  createNewUser: function(email, token) {
    /**
     * Non-existent constraints for time are represented as empty string
     * @return {Array} Non-existent constraints for seven days
     **/
    function initialiseConstraints() {
      return [{startTime: '', endTime: ''},
        {startTime: '', endTime: ''},
        {startTime: '', endTime: ''},
        {startTime: '', endTime: ''},
        {startTime: '', endTime: ''},
        {startTime: '', endTime: ''},
        {startTime: '', endTime: ''}];
    }

    const user = new User({
      email: email,
      token: token,
      constraints: initialiseConstraints(),
    });

    let success = false;

    user.save((error) => {
      if (error) {
        console.log('[Error creating new user] \n' + error);
        success = false;
      } else {
        console.log('[Created new user] Email: ' + email);
        success = true;
      }
    });

    return success;
  },

  /**
   * Retrieves token of a user given the email address which uniquely identifies a user.
   * @param {String} email
   * @return {String} If token exists return it in String format, otherwise returns null.
   */
  getToken: async function(email) {
    try {
      const user = await User.findOne({email});
      return user ? user.token : null;
    } catch (err) {
      console.log(err);
      return null;
    }
  },

  /**
   * Updates a user's token value with a new token, given the User ID and Team ID
   * which uniquely identifies a user.
   * @param {String} email
   * @param {String} newToken
   * @return {boolean} Returns true if successful, false if token already exists in database.
   */
  updateToken: async function(email, newToken) {
    if (await this.tokenExists(newToken)) {
      console.log('[Error updating token] Token already exists in database');
      return false;
    } else {
      User.findOneAndUpdate({email: email}, {email: email, token: newToken});
      console.log('[Token updated successfully]');
      return true;
    }
  },

  /**
   * Checks if the user, identified by a User ID and Team ID, exists in the database.
   * @param {String} email
   * @return {boolean} Returns true if there exists a user registered with this email.
   */
  userExists: async function(email) {
    return await User.exists({email: email});
  },

  /**
   * Checks if the given token exists for any user in the database
   * @param {String} token
   * @return {boolean} Returns true is token exists in database, false otherwise.
   */
  tokenExists: async function(token) {
    return await User.exists({token: token});
  },

  /**
   * TODO: Comment
   * @param {String} email
   * @param {String} startTime represented in ISO format
   * @param {String} endTime represented in ISO format
   * @param {Number} dayOfWeek - TODO: Amelia + Hasan create constants where Monday is 0
   */
  setConstraint: async function(email, startTime, endTime, dayOfWeek) {
    await User.findOneAndUpdate(
        {'email': email},
        {'$set': {
          [`constraints.${dayOfWeek}.startTime`]: Time.getTimeFromISO(startTime),
          [`constraints.${dayOfWeek}.endTime`]: Time.getTimeFromISO(endTime),
        }},
    );
  },
};