// Load User model
const User = require('../models/user.model');
const mongoose = require('mongoose');
const {DateTime} = require('luxon');

const context = {
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
   * @param {String} googleTokens
   * @param {String} slackEmail
   * @param {String} slackId
   * @return {boolean} success
   */
  createNewUser: function(googleEmail, googleTokens, slackEmail, slackId) {
    /**
     * Non-existent constraints for time are represented as empty string
     * @return {Array} Non-existent constraints for seven days
     **/
    function initialiseConstraints() {
      const workingDay = [{
        'startTime': DateTime.fromObject({hour: 9}),
        'endTime': DateTime.fromObject({hour: 17}),
      }];
      return [workingDay, workingDay, workingDay, workingDay, workingDay, [], []];
    }

    /**
     * Initialise frequencies
     * histFreq dimensions: 7 x 48
     * @return {({histFreq: [[]], timestamp: null})[]}
     */
    function initialiseFrequencies() {
      return Array(4).fill(0).map((_) => {
        return {'histFreq': Array(7).fill(0).map((_) => Array(48).fill(0)), 'timestamp': null};
      });
    }

    const doc = {
      google: {email: googleEmail.toLowerCase(), token: googleTokens},
      constraints: initialiseConstraints(),
      frequencies: initialiseFrequencies(),
    };

    if (slackEmail && slackId) {
      doc.slack = {
        email: slackEmail.toLowerCase(), id: slackId,
      };
    }

    const user = new User(doc);

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
   * Deletes a user along with all its associated data, given its email (either Slack or Google email)
   * @param {String} email - The user's Google email address
   */
  deleteUser: async function(email) {
    await User.deleteOne({'google.email': email});
  },

  /**
   * Returns all user data stored in the database
   * @return {Promise<null|any>}
   */
  getAllUserData: async function() {
    return await User.find({});
  },

  /**
   * Return the user which matches the attribute name and value
   * @param {String} name
   * @param {any} value
   */
  _getUserByAttribute: async function(name, value) {
    try {
      const user = await User.findOne({[name]: value});
      if (!user) throw new Error('User Not Found');
      return user;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Return the slack email from google email
   * @param {String} email
   */
  getSlackEmailFromGoogleEmail: async function(email) {
    try {
      return (await context._getUserByAttribute('google.email', email)).slack.email;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * Return the google email from slack email
   * @param {String} email
   */
  getGoogleEmailFromSlackEmail: async function(email) {
    try {
      return (await context._getUserByAttribute('slack.email', email)).google.email;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * Return google emails from slack emails
   * @param {Array} emails
   */
  getGoogleEmailsFromSlackEmails: async function(emails) {
    try {
      const users = await context.getAllUserData();
      const googleEmails = [];
      for (const user of users) {
        if (user.slack && user.slack.email && emails.includes(user.slack.email.toLowerCase())) {
          googleEmails.push(user.google.email);
        }
      }
      return googleEmails;
    } catch (err) {
      console.error(err);
      return null;
    }
  },


  /**
   * Return the slack email given a slack user ID
   * @param {String} slackId
   */
  getSlackEmailFromSlackId: async function(slackId) {
    try {
      return (await context._getUserByAttribute('slack.id', slackId)).slack.email;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * Return the google email given a slack user ID
   * @param {String} slackId
   */
  getGoogleEmailFromSlackId: async function(slackId) {
    try {
      return (await context._getUserByAttribute('slack.id', slackId)).google.email;
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
  getFrequenciesForCategoryFromGoogleEmail: async function(email, category) {
    try {
      return (await context._getUserByAttribute('google.email', email.toLowerCase())).frequencies[category];
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * TODO: Comment
   * @param {String} email - The user's Google email address
   * @param {Number} category - index corresponding to correct event category (takes any category >= -1)
   * @param {Array} frequencyTable - new frequency table to set at the given index
   */
  setFrequenciesForCategoryFromGoogleEmail: async function(email, category, frequencyTable) {
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
  getTokenFromGoogleEmail: async function(email) {
    try {
      return (await context._getUserByAttribute('google.email', email.toLowerCase())).google.token;
    } catch (err) {
      console.log(err);
      return null;
    }
  },

  /**
   * Checks if the user, identified by a User ID and Team ID, exists in the database.
   * @param {String} email - The user's Google or Slack email address
   * @return {boolean} Returns true if there exists a user registered with this email.
   */
  userExists: async function(email) {
    return (await User.exists({'google.email': email.toLowerCase()}) || await User.exists({'slack.email': email.toLowerCase()}));
  },

  /**
   * Set a time where the user prefers to work.
   * @param {String} email - The user's Google email address
   * @param {String} startTime represented in ISO format
   * @param {String} endTime represented in ISO format
   * @param {Number} dayOfWeek
   */
  setConstraintFromGoogleEmail: async function(email, startTime, endTime, dayOfWeek) {
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
  getConstraintsFromGoogleEmail: async function(email) {
    try {
      const user = await User.findOne({'google.email': email});
      return user ? user.constraints : null;
    } catch (err) {
      console.log(err);
      return null;
    }
  },

};

module.exports = context;
