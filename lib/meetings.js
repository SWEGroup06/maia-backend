const {DateTime, Duration} = require('luxon');
const TIME = require('./time.js');
const DIALOGFLOW = require('./dialogflow.js');
const DATABASE = require('./database.js');
const GOOGLE = require('./google.js');
const SCHEDULER = require('../src/scheduler.js');

// change histFreqLifetime to change how often the hist freq is recalculated
const histFreqLifetime = Duration.fromObject({days: 5});

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

  async schedule(title, slackEmails, startDateRange, endDateRange, flexible) {
    const busyTimes = [];
    const constraints = [];
    const histFreqs = [];
    let category;

    if (!title || title === '') {
      category = -1;
    } else {
      category = await DIALOGFLOW.getCategory(title);
    }

    // TODO: Change to input
    const eventDuration = Duration.fromObject({hours: 1});

    const googleEmails = [];
    const tokens = [];
    const today = DateTime.local();
    // make sure start date time is after current time!
    startDateRange = DateTime.fromISO(startDateRange) > today ? startDateRange : today.toISO();
    const oneMonthAgo = today.minus(Duration.fromObject({days: 30}));
    for (const email of slackEmails) {
      // Check if a user with the provided details existing in the database
      if (!await DATABASE.userExists(email)) {
        throw new Error(`${email} is not signed in`);
      }

      // Get tokens from the database
      const token = JSON.parse(await DATABASE.getToken(email));

      // Retrieve user constraints in format: [{startTime: ISO Date/Time String, endTime: ISO Date/Time String}],
      const weekConstraints = await DATABASE.getConstraints(email);

      // Generate constraints in format the scheduler takes in
      const generatedConstraints = SCHEDULER.generateConstraints(weekConstraints, startDateRange, endDateRange);

      if (generatedConstraints.length !== 0) {
        constraints.push(generatedConstraints);
      }

      tokens.push(token);

      // Get Google email for creating meeting later
      googleEmails.push(await GOOGLE.getEmail(token));

      // Format busy times before pushing to array
      const data = await GOOGLE.getBusySchedule(token, startDateRange, endDateRange);
      if (data) busyTimes.push(data.map((e) => [e.start, e.end]));

      // check if history frequency in db for this user is not out of date
      const histFreqInfo = await DATABASE.getFrequenciesForCategoryFromID(email, category);
      let histFreq = histFreqInfo.histFreq;

      if (histFreqInfo.timestamp == null || today.diff(DateTime.fromISO(histFreqInfo.timestamp), ['minutes']) > histFreqLifetime) {
        console.log('OUT OF DATE!! UPDATING');
        // if out of date, recalculate hist freq and update in db
        const lastMonthHist = await GOOGLE.getMeetings(token, oneMonthAgo.toISO(), today.toISO());
        histFreq = await SCHEDULER.getUserHistory(lastMonthHist.map((e) => [e.start.dateTime, e.end.dateTime, e.summary]), category);
        await DATABASE.setFrequenciesByCategory(email, category, histFreq);
      }
      histFreqs.push(histFreq);
      // console.log('now: ', await DATABASE.getFrequenciesForCategoryFromID(email, category));
    }
    // Get free slots from the provided busy times
    const freeTimes = busyTimes.map((timeSlot) => SCHEDULER.getFreeSlots(timeSlot, startDateRange, endDateRange));

    // Using free times find a meeting slot and get the choice
    const chosenSlot = SCHEDULER.findMeetingSlot(freeTimes, eventDuration, constraints, histFreqs);
    if (!chosenSlot) {
      throw new Error('No meeting slot found');
    }

    const description = {flexible: flexible, category: category, startDateRange: startDateRange, endDateRange: endDateRange};

    // create meeting event in calendars of team members
    await GOOGLE.createMeeting(tokens[0],
        title !== '' ? title : `Meeting: ${DateTime.fromISO(chosenSlot.start).toLocaleString(DateTime.DATE_MED)}`,
        chosenSlot.start,
        chosenSlot.end,
        googleEmails,
        JSON.stringify(description));

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

  async getDescriptions(email, startDateRange, endDateRange) {
    try {
    // Check if a user with the provided details existing in the database
      if (!await DATABASE.userExists(email)) {
        console.log('error: '+ email + ' is not signed in');
        return;
      }

      // Get tokens from the database
      const token = JSON.parse(await DATABASE.getToken(email));
      const events = await GOOGLE.getMeetings(token, startDateRange, endDateRange);
      if (!events || events.length === 0) {
        console.log('No event found in time frame');
        return;
      }

      const eventsWithDescription = [];
      // could possible have the same summary multiple times
      events.forEach((element) => {
        try {
          const description = JSON.parse(element.description);
          if (description.flexible !== null &&
                  description.category !== null &&
                  description.startDateRange &&
                  description.endDateRange) {
            eventsWithDescription.push({
              title: element.summary,
              startDate: element.start.dateTime,
              endDate: element.end.dateTime,
              flexible: description.flexible,
              category: description.category,
              startDateRange: description.startDateRange,
              endDateRange: description.endDateRange,
            });
            console.log('yes');
          }
        } catch (err) {
          console.log('no');
        }
      });

      console.log(eventsWithDescription);

      return eventsWithDescription;
    } catch (error) {
      console.error(error);
    }
  },

  async reschedule(eventStartTime, meetingTitle, organiserSlackEmail, startOfRangeToRescheduleTo, endOfRangeToRescheduleTo) {
    const constraints = [];

    const today = DateTime.local();
    const oneMonthAgo = today.minus(Duration.fromObject({days: 30}));

    const histFreqs = [];

    let category;

    if (!title || title === '') {
      category = -1;
    } else {
      category = await DIALOGFLOW.getCategory(title);
    }

    // check organiser of event (the person trying to reschedule it) is
    // signed in and check they are the organiser
    if (!await DATABASE.userExists(organiserSlackEmail)) {
      throw new Error(`${organiserSlackEmail} is not signed in`);
    }
    // Get organiser's token from the database
    const organiserToken = JSON.parse(await DATABASE.getToken(organiserSlackEmail));

    let events;

    if (eventStartTime) {
      // Search for an event with the given date, as no meeting title has been provided
      events = await GOOGLE.getEvents(organiserToken, eventStartTime);
    } else if (meetingTitle) {
      // Search for an event with the given title, as no event start time has been provided
      const oneMonthLater = today.plus({'days': 30});
      events = await GOOGLE.getEventByName(organiserToken, meetingTitle, today.toISO(), oneMonthLater.toISO());
    }

    if (!events || events.length === 0 ||
     (eventStartTime && !TIME.compareTime(events[0].start.dateTime, eventStartTime))) {
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
      if (data) busyTimes.push(data.map((e) => [e.start, e.end]));

      // check if history frequency in db for this user is not out of date
      const histFreqInfo = await DATABASE.getFrequenciesForCategoryFromID(email, category);
      console.log('histfreqinfo: ', histFreqInfo);
      let histFreq = histFreqInfo.histFreq;
      if (histFreq == null || histFreqInfo.timestamp.minus(today) > histFreqLifetime) {
        // if out of date, recalculate hist freq and update in db
        const lastMonthHist = await GOOGLE.getMeetings(token, oneMonthAgo.toISO(), today.toISO());
        histFreq = SCHEDULER.getUserHistory(lastMonthHist.map((e) => [e.start.dateTime, e.end.dateTime, e.summary]), category);
      }
      histFreqs.push(histFreq);
    }

    // Get free slots from the provided busy times
    const freeTimes = busyTimes.map((timeSlot) => SCHEDULER.getFreeSlots(timeSlot, startDate, endDate));

    // Using free times find a meeting slot and get the choice
    const chosenSlot = SCHEDULER.findMeetingSlot(freeTimes, eventDuration, constraints, histFreqs);

    if (!chosenSlot) {
      throw new Error('No meeting slot found');
    }

    // reschedule meeting to this new time
    await GOOGLE.updateMeeting(organiserToken, originalEvent, chosenSlot.start, chosenSlot.end);

    return chosenSlot;
  },
};
