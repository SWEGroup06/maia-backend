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

  async schedule(slackEmails, startDate, endDate, flexible) {
    const busyTimes = [];
    const constraints = [];
    const lastMonthHistories = [];

    // TODO: Change to input
    // const startDate = new Date().toISOString();
    // const endDate = new Date('6 nov 2020 23:30').toISOString();
    const eventDuration = Duration.fromObject({hours: 1});

    const googleEmails = [];
    const tokens = [];
    const today = DateTime.local();
    const oneMonthAgo = today.minus(Duration.fromObject({days: 30}));
    for (const email of slackEmails) {
      // Check if a user with the provided details existing in the database
      if (!await DATABASE.userExists(email)) {
        res.json({error: email + ' is not signed in'});
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

      tokens.push(token);

      // Get Google email for creating meeting later
      googleEmails.push(await GOOGLE.getEmail(token));

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
      res.json({error: 'No meeting slot found'});
      return;
    }
    // create meeting event in calendars of team members
    await GOOGLE.createMeeting(tokens[0], `Meeting: ${today.toString()}`, chosenSlot.start, chosenSlot.end, googleEmails);

    return chosenSlot;
  },


  /**
 * @param {number} email The slack user email.
 * @return {number} A list of meetings for the following week.
 */
  async getMeetings(email) {
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

  async reschedule(eventStartTime, organiserSlackEmail, startOfRangeToRescheduleTo, endOfRangeToRescheduleTo) {
    const constraints = [];

    const today = DateTime.local();
    const oneMonthAgo = today.minus(Duration.fromObject({days: 30}));

    const lastMonthHistories = [];

    // check organiser of event (the person trying to reschedule it) is
    // signed in and check they are the organiser
    if (!await DATABASE.userExists(organiserSlackEmail)) {
      throw new Error(`${organiserSlackEmail} is not signed in`);
    }
    // Get organiser's token from the database
    const organiserToken = JSON.parse(await DATABASE.getToken(organiserSlackEmail));
    // get attendee emails from event
    const events = await GOOGLE.getEvents(organiserToken, eventStartTime);

    if (!events || events.length === 0 || !TIME.compareTime(events[0].start.dateTime, eventStartTime)) {
      throw new Error('No event found to reschedule with given details');
    }

    const originalEvent = events[0];
    const eventEndTime = new Date(events[0].end.dateTime).toISOString();

    let attendeeEmails = [];
    if (originalEvent.attendees) {
      attendeeEmails = originalEvent.attendees.map((person) => person.email);
    }

    // find new time for event using scheduler
    const busyTimes = [];
    const eventDuration = DateTime.fromISO(eventEndTime).diff(DateTime.fromISO(new Date(events[0].start.dateTime).toISOString()));

    const startDate = startOfRangeToRescheduleTo;
    const endDate = endOfRangeToRescheduleTo;

    const organiserEmail = await GOOGLE.getEmail(organiserToken);
    // remove organiser from attendees to avoid adding twice
    attendeeEmails.pop();
    attendeeEmails.push(organiserEmail);
    // populate busyTimes array with all attendees' schedules
    for (const email of attendeeEmails) {
      // Check if a user with the provided details existing in the database
      if (!await DATABASE.userExists(email)) {
        throw new Error(`${email} is not signed in`);
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
      const lastMonthHist = await GOOGLE.getBusySchedule(token, oneMonthAgo.toISO(), today.toISO());

      if (data) busyTimes.push(data.map((e) => [e.start, e.end]));
      if (lastMonthHist) lastMonthHistories.push(lastMonthHist.map((e) => [e.start, e.end]));
    }

    // Get free slots from the provided busy times
    const freeTimes = busyTimes.map((timeSlot) => SCHEDULER.getFreeSlots(timeSlot, startDate, endDate));
    // Using free times find a meeting slot and get the choice
    const chosenSlot = SCHEDULER.findMeetingSlot(freeTimes, eventDuration, constraints, lastMonthHistories);

    if (!chosenSlot) {
      throw new Error('No meeting slot found');
    }

    // reschedule meeting to this new time
    await GOOGLE.updateMeeting(organiserToken, originalEvent, chosenSlot.start, chosenSlot.end);

    return chosenSlot;
  },
};
