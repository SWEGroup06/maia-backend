
const DATABASE = require('./database');
const AUTH = require('./auth');
module.exports = {
  /**
 * @param {number} email The slack user email.
 * @return {number} A list of meetings for the following week.
 */
  getMeetings: async function(email) {
    try {
    // Check if a user with the provided details existing in the database
      if (!await DATABASE.userExists(email)) {
        res.json({error: email + ' is not signed in'});
        return;
      }

      // Get tokens from the database
      const token = JSON.parse(await DATABASE.getToken(email));
      const today = new Date();
      // End date in one week for now
      const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()+7);
      const events = await AUTH.getMeetings(token, today.toISOString(), endDate.toISOString());

      if (!events || events.length === 0) {
        console.log('No event found in time frame');
        return;
      }
      // could possible have the same summary multiple times
      const eventDict = events.map((event) => [event.summary, event.start.dateTime, event.end.dateTime]);
      console.log('starttime: ' + eventDict[0][1]);
      console.log('endtime: ' + eventDict[0][2]);
      return eventDict;
    } catch (error) {
      console.error(error);
    }
  },
};


