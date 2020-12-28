// Load User model
const User = require('../models/user.model');
const mongoose = require('mongoose');
const {DateTime} = require('luxon');

module.exports = {
  /**
   * Sets up a connection with the MongoDB database.
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
   * TODO: Ali
   */
  closeDatabaseConnection: function() {
    mongoose.disconnect();
  },

  /**
   * Creates a new user in the database, uniquely identified by User ID, Team ID and token
   * @param {String} googleEmail
   * @param {String} googleAuthToken
   * @param {String} slackEmail
   * @param {String} slackId
   * @return {boolean} success
   */
  createNewUser: function(googleEmail, googleAuthToken, slackEmail, slackId) {
    /**
     * Non-existent constraints for time are represented as empty string
     * @return {Array} Non-existent constraints for seven days
     **/
    function initialiseConstraints() {
      const workingDay = [{'startTime': DateTime.fromObject({hour: 9}),
        'endTime': DateTime.fromObject({hour: 17})}];
      return [workingDay, workingDay, workingDay, workingDay, workingDay, [], []];
    }

    /**
     * Initialise frequencies
     * @return {({histFreq: [], timestamp: null})[]}
     */
    function initialiseFrequencies() {
      return [{'histFreq': [], 'timestamp': null},
        {'histFreq': [], 'timestamp': null},
        {'histFreq': [], 'timestamp': null},
        {'histFreq': [], 'timestamp': null}];
    }

    const user = new User({
      // slack: {email: slackEmail.toLowerCase(), id: slackId},
      google: {email: googleEmail.toLowerCase(), token: googleAuthToken},
      constraints: initialiseConstraints(),
      frequencies: initialiseFrequencies(),
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
  getEmailFromSlackID: async function(userID) {
    try {
      const user = await User.findOne({'slack.id': userID});
      return user ? user.email : null;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * Return the table of frequencies given a slack user ID
   * @param {String} userID
   */
  getFrequenciesFromSlackID: async function(userID) {
    try {
      const user = await User.findOne({'slack.id': userID});
      return user ? user.frequencies : null;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * Return the table of frequencies given a slack user ID and the category
   * @param {String} email: user's slack
   * @param {Number} category
   */
  getFrequenciesForCategoryFromID: async function(email, category) {
    try {
      const user = await User.findOne({'google.email': email.toLowerCase()});
      console.log(user.google.email);
      if (!user) {
        console.log('ERROR: user ', email, ' not found');
      }
      return user ? user.frequencies[category] : null;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * Updates a user's array of frequencies table with a new array of frequency tables, given the User ID
   * which uniquely identifies a user.
   * @param {String} slackId
   * @param {Array} frequencies
   * @return {boolean} Returns true if successful, null if update fails.
   */
  updateFrequencies: async function(slackId, frequencies) {
    try {
      await User.findOneAndUpdate({'slack.id': slackId},
          {'frequencies': frequencies});
      console.log('[Frequencies updated successfully]');
      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  },

  /**
   * TODO: Comment
   * @param {String} email - The user's Google email address
   * @param {Number} category - index corresponding to correct event category (takes any category >= -1)
   * @param {Array} frequencyTable - new frequency table to set at the given index
   */
  setFrequenciesByCategory: async function(email, category, frequencyTable) {
    try {
      await User.findOneAndUpdate(
          {'google.email': email},
          {$set: {
            [`frequencies.${category}.histFreq`]: frequencyTable,
            [`frequencies.${category}.timestamp`]: new Date().toISOString()},
          },
      );
    } catch (err) {
      console.log(err);
    }
  },

  /**
   * Retrieves token of a user given the email address which uniquely identifies a user.
   * @param {String} email - The user's Google email address
   * @return {String} If token exists return it in String format, otherwise returns null.
   */
  getToken: async function(email) {
    try {
      // Tries to find a user associated with Google email
      const user = await User.findOne({'google.email': email.toLowerCase()});
      return user ? user.google.token : null;
    } catch (err) {
      console.log(err);
      return null;
    }
  },

  /**
   * Updates a user's token value with a new token, given the User ID and Team ID
   * which uniquely identifies a user.
   * @param {String} email - The user's Google email address
   * @param {String} newToken
   * @return {boolean} Returns true if successful, false if token already exists in database.
   */
  updateToken: async function(email, newToken) {
    if (await this.tokenExists(newToken)) {
      console.log('[Error updating token] Token already exists in database');
      return false;
    } else {
      User.findOneAndUpdate({'google.email': email}, {'google.email': email, 'google.token': newToken});
      console.log('[Token updated successfully]');
      return true;
    }
  },

  /**
   * Checks if the user, identified by a User ID and Team ID, exists in the database.
   * @param {String} email - The user's Google or Slack email address
   * @return {boolean} Returns true if there exists a user registered with this email.
   */
  userExists: async function(email) {
    return (await User.exists({'google.email': email}) || await User.exists({'slack.email': email.toLowerCase()}));
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
   * Set a time where the user prefers to work.
   * @param {String} email - The user's Google email address
   * @param {String} startTime represented in ISO format
   * @param {String} endTime represented in ISO format
   * @param {Number} dayOfWeek
   */
  setConstraint: async function(email, startTime, endTime, dayOfWeek) {
    // TODO: Ensure that two of the same constraints can't be added into the array
    // if (User.find({[`constraints.${dayOfWeek}`]: {
    //   $elemMatch: {'startTime': startTime, 'endTime': endTime},
    // }})) {
    //   return;
    // }

    await User.findOneAndUpdate(
        {'google.email': email},
        {$push: {
          [`constraints.${dayOfWeek}`]: {'startTime': startTime, 'endTime': endTime},
        }},
    );
  },

  /**
   * Retrieve the constraints of a user
   * @param {String} email - The user's Google email address
   * @return {Array} 2D array of size 7. Every inner array contains constraint object {startDateTime, endDateTime}
   */
  getConstraints: async function(email) {
    try {
      const user = await User.findOne({'google.email': email});
      return user ? user.constraints : null;
    } catch (err) {
      console.log(err);
      return null;
    }
  },

  /**
   * Deletes a user along with all its associated data, given its email (either Slack or Google email)
   * @param {String} email - The user's Google email address
   */
  deleteUser: async function(email) {
    await User.deleteOne({'google.email': email});
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
