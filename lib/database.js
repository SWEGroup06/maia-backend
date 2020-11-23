// Load User model
const User = require('../models/user.model');
const mongoose = require('mongoose');

module.exports = {
  /**
   * TODO: Comment
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
   * @param {String} userID
   * @param {String} slackEmail
   * @param {String} googleEmail
   * @param {String} googleAuthToken
   * @return {boolean} success
   */
  createNewUser: function(userID, slackEmail, googleEmail, googleAuthToken) {
    /**
     * Non-existent constraints for time are represented as empty string
     * @return {Array} Non-existent constraints for seven days
     **/
    function initialiseConstraints() {
      return [[], [], [], [], [], [], []];
    }

    const user = new User({
      id: userID,
      email: slackEmail,
      google: {email: googleEmail.toLowerCase(), token: googleAuthToken},
      constraints: initialiseConstraints(),
    });

    let success = false;

    user.save((error) => {
      if (error) {
        console.log('[Error creating new user] \n' + error);
        success = false;
      } else {
        console.log('[Created new user] Email: ' + slackEmail);
        success = true;
      }
    });

    return success;
  },

  /**
   * Return the slack email given a slack user ID
   * @param {String} userID
   */
  getEmailFromID: async function(userID) {
    try {
      const user = await User.findOne({id: userID});
      return user ? user.email : null;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * Retrieves token of a user given the email address which uniquely identifies a user.
   * @param {String} email
   * @return {String} If token exists return it in String format, otherwise returns null.
   */
  getToken: async function(email) {
    try {
      // Tries to find a user associated with slack email
      let user = await User.findOne({email});
      // If no user with slack email is found, checks google emails
      if (!user) {
        user = await User.findOne({'google.email': email.toLowerCase()});
      }
      return user ? user.google.token : null;
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
      User.findOneAndUpdate({$or: [{'email': email}, {'google.email': email}]},
          {email: email, token: newToken});
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
    return (await User.exists({email: email}) || await User.exists({'google.email': email.toLowerCase()}));
  },

  /**
   * Checks if the given token exists for any user in the database
   * @param {String} token
   * @return {boolean} Returns true is token exists in database, false otherwise.
   */
  tokenExists: async function(token) {
    return await User.exists({'google.token': token});
  },

  /**
   * TODO: Comment
   * @param {String} email
   * @param {String} startTime represented in ISO format
   * @param {String} endTime represented in ISO format
   * @param {Number} dayOfWeek - TODO: Amelia + Hasan create constants where Monday is 0
   */
  setConstraint: async function(email, startTime, endTime, dayOfWeek) {
    // TODO: Ensure that two of the same constraints can't be added into the array
    // if (User.find({[`constraints.${dayOfWeek}`]: {
    //   $elemMatch: {'startTime': startTime, 'endTime': endTime},
    // }})) {
    //   return;
    // }

    await User.findOneAndUpdate(
        {$or: [{'email': email}, {'google.email': email}]},
        {$push: {
          [`constraints.${dayOfWeek}`]: {'startTime': startTime, 'endTime': endTime},
        }},
    );
  },

  /**
   * TODO: Comment
   * @param {String} email
   * @return {Promise<null|any>}
   */
  getConstraints: async function(email) {
    try {
      let user = await User.findOne({email});
      if (!user) {
        user = await User.findOne({'google.email': email.toLowerCase()});
      }
      return user ? user.constraints : null;
    } catch (err) {
      console.log(err);
      return null;
    }
  },

  /**
   * Deletes a user along with all its associated data, given its email (either Slack or Google email)
   * @param {String} email
   */
  deleteUser: async function(email) {
    await User.deleteOne({$or: [{'email': email}, {'google.email': email}]});
    console.log('Successfully deleted account associated with email: ' + email);
  },

  /**
   * Returns all user data stored in the database
   * @return {Promise<null|any>}
   */
  getAllUserData: async function() {
    return await User.find({});
  },

};
