const mongoose = require('mongoose');

// Load User model
const User = require('../models/user.model');

/*
 * TODO List:
 *  - Add constraints stuff
 *  - Do some further checking in each function
 *  - Make void functions return a boolean according to success
 *  - Return console logs for each function
 */

module.exports = {
  connect: function(uri) {
    // Connect to MongoDB using the provided URI
    mongoose.connect(uri, {
      useNewUrlParser: true,
      useCreateIndex: true,
      useUnifiedTopology: true,
    });

    return new Promise(function(resolve) {
      mongoose.connection.once('open', function() {
        console.log('Database connected');
        module.exports.instance = {
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
              token,
            });

            return new Promise(function(resolve, reject) {
              user.save(function(err) {
                if (err) {
                  console.log('[Error creating new user] \n' + error);
                  reject(err);
                  return;
                }

                console.log('[Created new user] ' + 'userID: ' + user.id.userID + ' teamID: ' + user.id.teamID);
                resolve();
              });
            });
          },

          /**
           * Retrieves the token of a user given the User ID and Team ID which uniquely
           * identifies a user.
           * @param {String} userID
           * @param {String} teamID
           * @return {String} If token exists return it in String format, otherwise returns null.
           */
          getToken: function(userID, teamID) {
            return new Promise(function(resolve, reject) {
              User.findOne({id: {userID, teamID}}).then(function(user) {
                resolve(user && user.token ? user.token : null);
              }).catch(reject);
            });
          },

          /**
           * Updates a user's token value with a new token, given the User ID and Team ID
           * which uniquely identifies a user.
           * @param {String} userID
           * @param {String} teamID
           * @param {String} token
           * @return {boolean} Returns true if successful, false if token already exists in database.
           */
          updateToken: async function(userID, teamID, token) {
            if (await this.tokenExists(token)) {
              console.log('[Error updating token] Token already exists in database');
              return false;
            } else {
              User.findOneAndUpdate({id: {userID, teamID}}, {id: {userID, teamID}, token});
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
            return await User.exists({id: {userID, teamID}});
          },

          /**
           * Checks if the given token exists for any user in the database
           * @param {String} token
           * @return {boolean} Returns true is token exists in database, false otherwise.
           */
          tokenExists: async function(token) {
            return await User.exists({token});
          },
        };
        resolve();
      });
    });
  },
};
