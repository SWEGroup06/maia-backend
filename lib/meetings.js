const {DateTime, Duration} = require('luxon');
const TIME = require('./time.js');

const DATABASE = require('./database.js');
const GOOGLE = require('./google.js');

const SCHEDULER = require('../src/scheduler.js');

module.exports = {
  /**
   * @param {String} email The slack user email.
   * @param {Array} days constrainted days.
   * @param {Object} times constrainted times.
   * @return {number} A list of meetings for the following week.
   */
  async setContraints(email, days, times) {
    // Check if a user with the provided details existing in the database
    if (!await DATABASE.userExists(email)) {
      throw new Error(`${email} is not signed in`);
    }

    // Set the constraints in the database
    for (let i = 0; i < 7; i++) {
      if (days[i] === 1) {
        for (let j = 0; j < times.length; j++) {
          await DATABASE.setConstraint(email, TIME.normaliseDate(times[j].startTime), TIME.normaliseDate(times[j].endTime), i);
        }
      }
    }
  },

  async scheduleMeeting() {
    // TODO: Move schedule meeting to here
  },


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

  reschedule: async function(eventStartTime, eventEndTime, newStartDateTime, newEndDateTime, organiserSlackEmail) {

    if (!organiserSlackEmail) {
      console.log('error: Organiser\'s slack email not found');
      return;
    }

    // check if event to be reschedule has been specified
    if (!eventStartTime) {
      console.log('error: No event start time specified for rescheduling');
    }

    if (!eventEndTime) {
      console.log('error: No event end time specified for rescheduling');
    }

    let startOfRangeToRescheduleTo;
    if (!newStartDateTime) {
      startOfRangeToRescheduleTo = DateTime.local();
    } else {
      startOfRangeToRescheduleTo = DateTime.fromISO(newStartDateTime);
    }

    let endOfRangeToRescheduleTo;
    if (!newEndDateTime) {
      endOfRangeToRescheduleTo = DateTime.local(startOfRangeToRescheduleTo.year, startOfRangeToRescheduleTo.month, startOfRangeToRescheduleTo.day + 14);
    } else {
      endOfRangeToRescheduleTo = DateTime.fromISO(newEndDateTime);
    }

    try {
      const constraints = [];

      const today = DateTime.local();
      const oneMonthAgo = today.minus(Duration.fromObject({days: 30}));

      const lastMonthHistories = [];

      // check organiser of event (the person trying to reschedule it) is
      // signed in and check they are the organiser
      if (!await DATABASE.userExists(organiserSlackEmail)) {
        console.log('error: ' + organiserSlackEmail + ' is not signed in`');
        return;
      }
      // Get organiser's token from the database
      const organiserToken = JSON.parse(await DATABASE.getToken(organiserSlackEmail));
      // get attendee emails from event
      const events = await GOOGLE.getEvents(organiserToken, eventStartTime);

      if (!events || events.length === 0 || !TIME.compareTime(events[0].start.dateTime, eventStartTime)) {
        console.log('error: No event found to reschedule with given details');
        return;
      }
      const originalEvent = events[0];
      const eventEndTime = new DateTime(events[0].end.dateTime).toISO();

      let attendeeEmails = [];
      if (originalEvent.attendees) {
        attendeeEmails = originalEvent.attendees.map((person) => person.email);
      }

      // find new time for event using scheduler
      const busyTimes = [];
      const eventDuration = DateTime.fromISO(eventEndTime).diff(DateTime.fromISO(new DateTime(events[0].start.dateTime).toISO()));

      const startDate = startOfRangeToRescheduleTo.toISO();
      const endDate = endOfRangeToRescheduleTo.toISO();

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
        // TODO: const weekConstraints = await DATABASE.getConstraints(email);

        // Generate constraints in format the scheduler takes in
        // TODO: const generatedConstraints = SCHEDULER.generateConstraints(weekConstraints, startDate, endDate);

        // TODO: if (generatedConstraints.length !== 0) {
        // TODO:   constraints.push(generatedConstraints);
        // }

        // Format busy times before pushing to array

        const data = await GOOGLE.getBusySchedule(token, startDate, endDate);
        const lastMonthHist = await GOOGLE.getBusySchedule(token, oneMonthAgo.toISO(), today.toISO());

        if (data) busyTimes.push(data.map((e) => [e.start, e.end]));
        if (lastMonthHist) lastMonthHistories.push(lastMonthHist.map((e) => [e.start, e.end]));
      }

      // Get free slots from the provided busy times
      const freeTimes = busyTimes.map((timeSlot) => SCHEDULER.getFreeSlots(timeSlot, startDate, endDate));
      // Using free times find a meeting slot and get the choice
      const chosenSlot = SCHEDULER.findMeetingSlot(freeTimes, eventDuration, constraints, lastMonthHistories);

      if (!chosenSlot) {
        console.log('error: No meeting slot found');
        return;
      }

      console.log(chosenSlot);

      // reschedule meeting to this new time
      await GOOGLE.updateMeeting(organiserToken, originalEvent, chosenSlot.start, chosenSlot.end);
      return chosenSlot;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
};
