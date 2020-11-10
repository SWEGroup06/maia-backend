const {DateTime} = require('luxon');

const DATABASE = require('./database.js');
const GOOGLE = require('./google.js');

const SCHEDULER = require('../src/scheduler.js');

module.exports = {
  /**
 * @param {number} email The slack user email.
 * @return {number} A list of meetings for the following week.
 */
  getMeetings: async function(email) {
    try {
    // Check if a user with the provided details existing in the database
      if (!await DATABASE.userExists(email)) {
        console.log('error: '+ email + ' is not signed in');
        return;
      }

      // Get tokens from the database
      const token = JSON.parse(await DATABASE.getToken(email));
      const today = new Date();
      // End date in one week for now
      const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()+7);
      const events = await GOOGLE.getMeetings(token, today.toISOString(), endDate.toISOString());

      if (!events || events.length === 0) {
        console.log('No event found in time frame');
        return;
      }
      // could possible have the same summary multiple times
      const eventDict = events.map((event) => [event.summary, event.start.dateTime, event.end.dateTime]);
      return eventDict;
    } catch (error) {
      console.error(error);
    }
  },

  reschedule: async function(eventStartTime, eventEndTime, organiserSlackEmail) {
    try {
      const constraints = [];
      // check organiser of event (the person trying to reschedule it) is
      // signed in and check they are the organiser
      if (!await DATABASE.userExists(organiserSlackEmail)) {
        console.log('Organiser is not signed in');
        return;
      }
      // Get organiser's token from the database
      const organiserToken = JSON.parse(await DATABASE.getToken(organiserSlackEmail));
      // get attendee emails from event
      const events = await GOOGLE.getEvents(organiserToken, eventStartTime, eventEndTime);

      if (!events || events.length === 0) {
        console.log('No event found to reschedule with given details');
        return;
      }

      const originalEvent = events[0];
      let attendeeEmails = [];
      if (originalEvent.attendees) {
        attendeeEmails = originalEvent.attendees.map((person) => person.email);
      }

      // find new time for event using scheduler
      const busyTimes = [];
      const eventDuration = DateTime.fromISO(eventEndTime).diff(DateTime.fromISO(eventStartTime));

      const startDate = new Date().toISOString();
      const endDate = new Date('6 nov 2020 23:30').toISOString();

      const organiserEmail = await GOOGLE.getEmail(organiserToken);
      // remove organiser from attendees to avoid adding twice
      attendeeEmails.pop();
      attendeeEmails.push(organiserEmail);
      // populate busyTimes array with all attendees' schedules
      for (const email of attendeeEmails) {
        // Check if a user with the provided details existing in the database
        if (!await DATABASE.userExists(email)) {
          console.log('error: ' + email + ' is not signed into Maia');
          return;
        }
        // Get tokens from the database
        const token = JSON.parse(await DATABASE.getToken(email));

        // Retrieve user constraints in format: [{startTime: ISO Date/Time String, endTime: ISO Date/Time String}],
        const weekConstraints = await DATABASE.getConstraints(email);

        // Generate constraints in format the scheduler takes in
        const generatedConstraints = SCHEDULER.generateConstraints(weekConstraints, startDate, endDate);

        if (generatedConstraints.length !== 0) {
          constraints.push(generatedConstraints);
        }

        // Format busy times before pushing to array
        const data = await GOOGLE.getBusySchedule(token, startDate, endDate);
        if (data) busyTimes.push(data.map((e) => [e.start, e.end]));
      }

      // Get free slots from the provided busy times
      const freeTimes = busyTimes.map((timeSlot) => SCHEDULER.getFreeSlots(timeSlot, startDate, endDate));
      // Using free times find a meeting slot and get the choice
      const chosenSlot = SCHEDULER.findMeetingSlot(freeTimes, eventDuration, constraints);

      if (!chosenSlot) {
        await console.log('error: No meeting slot found');
        return;
      }

      // reschedule meeting to this new time
      await GOOGLE.updateMeeting(organiserToken, originalEvent, chosenSlot.start, chosenSlot.end);
      return chosenSlot;
    } catch (error) {
      console.error(error);
    }
  },

};
