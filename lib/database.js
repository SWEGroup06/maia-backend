// Load User model
const User = require("../models/user.model");
const mongoose = require("mongoose");
const { DateTime } = require("luxon");

const context = {
  /**
   * Sets up a connection with the MongoDB database.
   *
   * @return {Promise<void>}
   */
  getDatabaseConnection: async function () {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useCreateIndex: true,
        useUnifiedTopology: true,
        useFindAndModify: false,
      });
      console.log("Connection to DB Successful");
    } catch (error) {
      console.log("Connection to DB unsuccessful");
      console.error("Details:\n" + error);
    }
  },

  /**
   * Close the connection to the database
   */
  closeDatabaseConnection: function () {
    mongoose.disconnect();
  },

  /**
   * Creates a new user in the database, uniquely identified by User ID,
   * Team ID and token
   *
   * @param {string} googleEmail - Unique google email for new user
   * @param {string} googleTokens - Authentication token for new user
   * @param {string} slackEmail - slack email for new user
   * @param {string} slackId - slack ID for new user
   * @return {boolean}  - success is true or false depending on whether the
   * creation of the new user succeeded or not
   */
  createNewUser: function (googleEmail, googleTokens, slackEmail, slackId) {
    /**
     * Non-existent constraints for time are represented as empty string
     *
     * @return {Array} Non-existent constraints for seven days
     **/
    function initialiseConstraints() {
      const workingDay = [
        {
          startTime: DateTime.fromObject({ hour: 9 }),
          endTime: DateTime.fromObject({ hour: 17 }),
        },
      ];
      return [
        workingDay,
        workingDay,
        workingDay,
        workingDay,
        workingDay,
        [],
        [],
      ];
    }

    /**
     * Initialise frequencies
     * histFreq dimensions: 7 x 48
     * 48 slots corresponds to every 30 minute time slot in a 24 hour day
     *
     * @return {Array} - {({histFreq: [[]], timestamp: null})[]} each of the
     * 7 arrays is for a given day in the week
     */
    function initialiseFrequencies() {
      return Array(4)
        .fill(0)
        .map((_) => {
          return {
            histFreq: Array(7)
              .fill(0)
              .map((_) => Array(48).fill(0)),
            timestamp: null,
          };
        });
    }

    const doc = {
      google: { email: googleEmail.toLowerCase(), token: googleTokens },
      constraints: initialiseConstraints(),
      frequencies: initialiseFrequencies(),
      schedulingPreferences: {
        minBreakLength: 0,
        autoReschedulingInterval: null,
        clustering: true,
      },
    };

    if (slackEmail && slackId) {
      doc.slack = {
        email: slackEmail.toLowerCase(),
        id: slackId,
      };
    }

    const user = new User(doc);

    let success = false;

    user.save((error) => {
      if (error) {
        console.log("[Error creating new user] \n" + error);
        success = false;
      } else {
        console.log("[Created new user] Email: " + slackEmail);
        success = true;
      }
    });

    return success;
  },

  /**
   * Deletes a user along with all its associated data, given its email
   * (either Slack or Google email)
   *
   * @param {string} email - The user's Google email address
   */
  deleteUser: async function (email) {
    await User.deleteOne({ "google.email": email });
  },

  /**
   * Returns all user data stored in the database
   *
   * @return {Promise<null|any>} - Return every user in the database
   */
  getAllUserData: async function () {
    return await User.find({});
  },

  /**
   * Return the user which matches the attribute name and value
   *
   * @param {string} name - name for attribute
   * @param {any} value - attribute value
   * @return {Promise<null|any>} - Return the user with the given value for the
   * given attribute name
   */
  _getUserByAttribute: async function (name, value) {
    try {
      const user = await User.findOne({ [name]: value });
      if (!user) throw new Error("User Not Found");
      return user;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Return the Slack email from google email
   *
   * @param {string} email - users Slack email
   * @return {Promise<null|any>} - Return the Slack email for the user with the
   * given google email.
   */
  getSlackEmailFromGoogleEmail: async function (email) {
    try {
      return (await context._getUserByAttribute("google.email", email)).slack
        .email;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * Return the google email from Slack email
   *
   * @param {string} email - users Slack email
   * @return {Promise<null|any>} - Return the google email for the user with
   * the given Slack email
   */
  getGoogleEmailFromSlackEmail: async function (email) {
    try {
      return (await context._getUserByAttribute("slack.email", email)).google
        .email;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * Return google emails from Slack emails
   *
   * @param {Array} emails - a List of Slack emails
   * @return {Promise<null|any>} - return a List of google emails corresponding
   * to each given Slack email in the given array
   */
  getGoogleEmailsFromSlackEmails: async function (emails) {
    try {
      const users = await context.getAllUserData();
      const googleEmails = [];
      for (const user of users) {
        if (
          user.slack &&
          user.slack.email &&
          emails.includes(user.slack.email.toLowerCase())
        ) {
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
   * Return the Slack email given a Slack user ID
   *
   * @param {string} slackId - Users Slack ID
   * @return {Promise<null|any>} - Return the Slack email of the user with the
   * given slackID
   */
  getSlackEmailFromSlackId: async function (slackId) {
    try {
      return (await context._getUserByAttribute("slack.id", slackId)).slack
        .email;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * Return the google email given a Slack user ID
   *
   * @param {string} slackId - Users Slack ID
   * @return {Promise<null|any>} - Return the google email of the user with
   * the provided Slack ID
   */
  getGoogleEmailFromSlackId: async function (slackId) {
    try {
      return (await context._getUserByAttribute("slack.id", slackId)).google
        .email;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * Return the table of frequencies given a Slack user ID and the category
   *
   * @param {string} email - user's Slack email
   * @param {number} category - Unique integer value corresponding to an
   * event category
   * @return {Promise<null|any>} - Return the frequency table for the user
   * with the given email and category
   */
  getFrequenciesForCategoryFromGoogleEmail: async function (email, category) {
    try {
      return (
        await context._getUserByAttribute("google.email", email.toLowerCase())
      ).frequencies[category];
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /**
   * Given a google email, sets the frequency table for the given event category
   * to the new frequency table passed in as a a parameter
   *
   * @param {string} email - The user's Google email address
   * @param {number} category - index corresponding to correct event
   * category  (takes any category >= -1)
   * @param {Array} frequencyTable - new frequency table to set at the
   * specified index
   */
  setFrequenciesForCategoryFromGoogleEmail: async function (
    email,
    category,
    frequencyTable
  ) {
    try {
      await User.findOneAndUpdate(
        { "google.email": email },
        {
          $set: {
            [`frequencies.${category}.histFreq`]: frequencyTable,
            [`frequencies.${category}.timestamp`]: new Date().toISOString(),
          },
        }
      );
    } catch (err) {
      console.log(err);
    }
  },

  /**
   * Retrieves token of a user given the email address which uniquely
   * identifies a user.
   *
   * @param {string} email - The user's Google email address
   * @return {string} If token exists return it in String format, otherwise
   * returns null.
   */
  getTokenFromGoogleEmail: async function (email) {
    try {
      return (
        await context._getUserByAttribute("google.email", email.toLowerCase())
      ).google.token;
    } catch (err) {
      console.log(err);
      return null;
    }
  },

  /**
   * Checks if the user, identified by a User ID and Team ID, exists in the
   * database.
   *
   * @param {string} email - The user's Google or Slack email address
   * @return {boolean} Returns true if there exists a user registered with
   * this email address.
   */
  userExists: async function (email) {
    return (
      (await User.exists({ "google.email": email.toLowerCase() })) ||
      (await User.exists({ "slack.email": email.toLowerCase() }))
    );
  },

  /**
   * Set a time where the user prefers to work.
   *
   * @param {string} email - The user's Google email address
   * @param {string} startTime represented in ISO format
   * @param {string} endTime represented in ISO format
   * @param {number} dayOfWeek - Integer value corresponding to a day of the week
   * @return {Promise<void>}
   */
  setConstraintForDayFromGoogleEmail: async function (
    email,
    startTime,
    endTime,
    dayOfWeek
  ) {
    // TODO: Ensure that two of the same constraints can't be added into the array
    // if (User.find({[`constraints.${dayOfWeek}`]: {
    //   $elemMatch: {'startTime': startTime, 'endTime': endTime},
    // }})) {
    //   return;
    // }

    await User.findOneAndUpdate(
      { "google.email": email },
      {
        $push: {
          [`constraints.${dayOfWeek}`]: {
            startTime: startTime,
            endTime: endTime,
          },
        },
      }
    );
  },

  /**
   * Set the users working hours for every day given their google email
   * and the new array
   *
   * @param {string} email - google email of user
   * @param {Array} constraintsArr - fixed 2D array of size 7, in format:  [
   * [{startTime, endTime}], …]
   * @return {Promise<void>} - no clue
   */
  setConstraintsGivenFullArray: async function (email, constraintsArr) {
    try {
      await User.findOneAndUpdate(
        { "google.email": email },
        { $set: { [`constraints`]: constraintsArr } }
      );
    } catch (err) {
      console.log(err);
    }
  },

  /**
   * Retrieve the constraints of a user
   *
   * @param {string} email - The user's Google email address
   * @return {Array} 2D array of size 7. Every inner array contains
   * constraint  object {startDateTime, endDateTime}
   */
  getConstraintsFromGoogleEmail: async function (email) {
    try {
      const user = await User.findOne({ "google.email": email });
      return user ? user.constraints : null;
    } catch (err) {
      console.log(err);
      return null;
    }
  },

  /**
   * Get the minimum break length preference of a particular user (in
   * minutes),  given their Google email address.
   *
   * @param {string} email - email
   * @return {Promise<void>} - Return the users preferred minimum break length
   */
  getMinBreakLength: async function (email) {
    try {
      const user = await User.findOne({ "google.email": email });
      return user ? user.schedulingPreferences.minBreakLength : null;
    } catch (err) {
      console.log(err);
      return null;
    }
  },

  /**
   * Set a minimum break length preference for a particular user, given their
   * Google email address and a length (in minutes).
   *
   * @param {string} email - users email
   * @param {number} minBreakLength - the minimum break length in minutes
   * @return {Promise<void>} - Request to the MongoDB database
   */
  setMinBreakLength: async function (email, minBreakLength) {
    try {
      await User.findOneAndUpdate(
        { "google.email": email },
        { $set: { [`schedulingPreferences.minBreakLength`]: minBreakLength } }
      );
    } catch (err) {
      console.log(err);
    }
  },

  /**
   * Get the minimum auto rescheduling preference set by a particular user
   * (in minutes), given their Google email address.
   *
   * @param {string} email - user email
   * @return {Promise<void>} - Return the auto rescheduling interval stored
   * for the user
   */
  getAutoReschedulingInterval: async function (email) {
    try {
      const user = await User.findOne({ "google.email": email });
      return user ? user.schedulingPreferences.autoReschedulingInterval : null;
    } catch (err) {
      console.log(err);
      return null;
    }
  },

  /**
   * Set a minimum auto rescheduling preference for a particular user, given
   * their Google email address and a length (in minutes).
   *
   * @param {string} email - email
   * @param {number} minAutoReschedulingInterval - the minimum time in
   * advance  of which an event should be auto rescheduled
   * @return {Promise<void>} - Request to the MongoDB database
   */
  setAutoReschedulingInterval: async function (
    email,
    minAutoReschedulingInterval
  ) {
    try {
      await User.findOneAndUpdate(
        { "google.email": email },
        {
          $set: {
            [`schedulingPreferences.autoReschedulingInterval`]: minAutoReschedulingInterval,
          },
        }
      );
    } catch (err) {
      console.log(err);
    }
  },

  /**
   * Get whether the user would like to be notified of auto reschedule suggestions
   * or if reschedules should happen immediately without question,
   * given their Google email address.
   *
   * @param {string} email - user email
   * @return {Promise<void>} - Return the auto rescheduling interval stored
   * for the user
   */
  // getNotifyOfAutoReschedules: async function (email) {
  //   try {
  //     const user = await User.findOne({ "google.email": email });
  //     return user ? user.schedulingPreferences.notifyAutoReschedules : null;
  //   } catch (err) {
  //     console.log(err);
  //     return null;
  //   }
  // },

  /**
   * Set whether the user would like to be notified of auto reschedule suggestions
   * or if reschedules should happen immediately without question, given
   * their Google email address and their preference as a Boolean.
   *
   * @param {string} email - email
   * @param {Boolean} notify - the minimum time in
   * advance  of which an event should be auto rescheduled
   * @return {Promise<void>} - Request to the MongoDB database
   */
  // setNotifyOfAutoReschedules: async function (
  //     email,
  //     notify
  // ) {
  //   try {
  //     await User.findOneAndUpdate(
  //         { "google.email": email },
  //         {
  //           $set: {
  //             [`schedulingPreferences.notifyAutoReschedules`]: notify,
  //           },
  //         }
  //     );
  //   } catch (err) {
  //     console.log(err);
  //   }
  // },

  /**
   * Get the clustering preference set by a particular user (in minutes),
   * given their Google email address.
   *
   * @param {string} email - user email
   * @return {Promise<void>} - return users clustering preference as boolean
   */
  getClusteringPreference: async function (email) {
    try {
      const user = await User.findOne({ "google.email": email });
      return user ? user.schedulingPreferences.clustering : null;
    } catch (err) {
      console.log(err);
      return null;
    }
  },

  /**
   * Set a clustering preference for a particular user, given their
   * Google email address and a length (in minutes).
   *
   * @param {string} email - user email
   * @param {boolean} clusteringPreference - boolean determines if a user wants
   * the scheduler to cluster their events or not
   * @return {Promise} - request to database to set clustering preferences
   */
  setClusteringPreference: async function (email, clusteringPreference) {
    try {
      await User.findOneAndUpdate(
        { "google.email": email },
        { $set: { [`schedulingPreferences.clustering`]: clusteringPreference } }
      );
    } catch (err) {
      console.log(err);
    }
  },
};

module.exports = context;
