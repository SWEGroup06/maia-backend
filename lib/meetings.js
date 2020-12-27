const {DateTime, Duration} = require('luxon');
const TIME = require('./time.js');
const DIALOGFLOW = require('./dialogflow.js');
const DATABASE = require('./database.js');
const GOOGLE = require('./google.js');
const SCHEDULER = require('../src/scheduler.js');
const {getEventById} = require('./google.js');

// change histFreqLifetime to change how often the hist freq is recalculated
const HISTFREQLIFETIME = Duration.fromObject({days: 5});
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
let lastEventId = null;
const TODAY = DateTime.local();
const YESTERDAY = DateTime.local().minus(Duration.fromObject({days: 1}));
const ONEMONTHAGO = TODAY.minus(Duration.fromObject({days: 31}));

module.exports = {
  /** TODO: Comment
   * @param {String} email: The slack user email.
   * @param {Array} days: constrainted days.
   * @param {Object} times: constrainted times.
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
          await DATABASE.setConstraint(email,
              TIME.normaliseDate(times[j].startTime),
              TIME.normaliseDate(times[j].endTime), i);
        }
      }
    }
  },

  async getHistFreq(token, category, email) {
    let histFreqInfo = await DATABASE.getFrequenciesForCategoryFromID(email, category);
    let tried = 0;
    while (histFreqInfo.timestamp == null && tried < 2) {
      tried++;
      console.log('hist freq initialisation not complete yet');
      // wait for 5 seconds then try again
      await delay(3000);
      histFreqInfo = await DATABASE.getFrequenciesForCategoryFromID(email, category);
    }
    if (histFreqInfo.timestamp == null) {
      // tell user hist freqs are still being initialised
      return null;
    }
    let histFreq = histFreqInfo.histFreq;
    if (TODAY.diff(DateTime.fromISO(histFreqInfo.timestamp), ['minutes']) > HISTFREQLIFETIME) {
      console.log('OUT OF DATE!! UPDATING');
      // if out of date, recalculate hist freq and update in db
      let lastMonthHist = await GOOGLE.getMeetings(token, ONEMONTHAGO.toISO(), YESTERDAY.toISO());
      lastMonthHist = lastMonthHist.map((e) => [e.start.dateTime, e.end.dateTime, e.summary]);
      const categorisedSchedule = await SCHEDULER.getCategorisedSchedule(lastMonthHist);
      histFreq = await SCHEDULER.generateUserHistory(categorisedSchedule, category);
      await DATABASE.setFrequenciesByCategory(email, category, histFreq);
    }
    return histFreq;
  },
  /**
   * TODO: Comment
   * @param {String} title
   * @param {Array} slackEmails
   * @param {String} startDateRange
   * @param {String} endDateRange
   * @param {boolean} flexible
   * @param {number} duration
   * @return {Promise<*|{msg: string}>}
   */
  async schedule(title, slackEmails, startDateRange, endDateRange, flexible, duration) {
    const freeTimes = [];
    const constraints = [];
    const histFreqs = [];
    let category;

    console.log('---schedule---');
    console.log('start: ', startDateRange);
    console.log('end: ', endDateRange);

    if (!title || title === '') {
      // assume event is work related by default
      category = 1;
    } else {
      category = await DIALOGFLOW.getCategory(title);
    }

    // If duration is not specified, use default duration of one hour (60 minutes)
    const eventDuration = Duration.fromObject({minutes: (duration || 60)});
    console.log('cat', category);

    const googleEmails = [];
    const tokens = [];

    // make sure start date time is after current time!
    startDateRange = DateTime.fromISO(startDateRange) > TODAY ? startDateRange : TODAY.toISO();

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

      // TODO: change minBreakLength to from input
      const minBreakLength = Duration.fromObject({minutes: 15});

      // Format busy times and then get free slots from the provided busy times
      const data = await GOOGLE.getBusySchedule(token, startDateRange, endDateRange);
      if (data) freeTimes.push(SCHEDULER.getFreeSlots((data.map((e) => [e.start, e.end])), startDateRange, endDateRange, minBreakLength));

      // check if history frequency in db for this user has been initialised (if not wait and try again)
      const histFreq = await this.getHistFreq(token, category, email);
      if (histFreq == null) {
        return {
          msg: 1,
        };
      }
      histFreqs.push(histFreq);
      // console.log('now: ', await DATABASE.getFrequenciesForCategoryFromID(email, category));
    }
    // Using free times find a meeting slot and get the choice
    const chosenSlot = await SCHEDULER.findMeetingSlot(freeTimes, eventDuration, constraints, histFreqs);
    if (!chosenSlot) {
      console.log('nothing found');
      // throw new Error('No meeting slot found');
      return {
        msg: 2,
      };
    }

    const description = {
      flexible: flexible,
      category: category,
      startDateRange: startDateRange,
      endDateRange: endDateRange,
    };

    // create meeting event in calendars of team members
    const response = await GOOGLE.createMeeting(tokens[0],
     title !== '' ? title : `Meeting: ${DateTime.fromISO(chosenSlot.start).toLocaleString(DateTime.DATE_MED)}`,
     chosenSlot.start,
     chosenSlot.end,
     googleEmails,
     JSON.stringify(description));

    console.log('setting last event id');
    console.log(response);
    lastEventId = response.data.id;
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
        console.log('error: ' + email + ' is not signed in');
        return;
      }

      // Get tokens from the database
      const token = JSON.parse(await DATABASE.getToken(email));
      const today = new Date();
      // End date in one week for now
      const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
      const events = await GOOGLE.getMeetings(token, today.toISOString(), endDate.toISOString());

      if (!events || events.length === 0) {
        // console.log('No event found in time frame');
        return null;
      }
      // could possible have the same summary multiple times
      const eventDict = events.map((event) => [event.summary, event.start.dateTime, event.end.dateTime]);
      return eventDict;
    } catch (error) {
      console.error(error);
    }
  },

  /**
   * TODO: Comment
   * @param {Array} events
   * @return {[]}
   */
  getDescriptions: (events) => {
    if (!events || events.length === 0) {
      // console.log('No event found in time frame');
      return null;
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
            id: element.id,
            description: element.description,
            attendees: element.attendees,
          });
          // console.log('yes');
        }
      } catch (err) {
        // console.log('no');
      }
    });

    // console.log(eventsWithDescription);

    return eventsWithDescription;
  },

  /**
   * TODO: Comment
   * @param {String} eventStartTime
   * @param {String} title
   * @param {String} organiserSlackEmail
   * @param {String} startOfRangeToRescheduleTo
   * @param {String} endOfRangeToRescheduleTo
   * @param {boolean} specificTimeGiven
   * @return {Promise<{msg: number}>}
   */
  async reschedule(eventStartTime, title, organiserSlackEmail, startOfRangeToRescheduleTo,
      endOfRangeToRescheduleTo, specificTimeGiven) {
    const constraints = [];
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
    } else if (title) {
      // Search for an event with the given title, as no event start time has been provided
      const oneMonthLater = TODAY.plus({'days': 30});
      events = await GOOGLE.getEventByName(organiserToken, title, TODAY.toISO(), oneMonthLater.toISO());
    }

    // TODO Delete these logs
    console.log('EVENTS******************');
    console.log(events);
    console.log('************************');

    console.log('eventStartTime******************');
    console.log(DateTime.fromISO(eventStartTime).toISO());
    console.log('************************');

    console.log('events[0].start.dateTime******************');
    console.log(events[0].start.dateTime);
    console.log('************************');
    // TODO End of logs to delete

    // If no event is found with the given details, return this information
    if (!events || events.length === 0 ||
     (eventStartTime && !TIME.compareTime(events[0].start.dateTime, eventStartTime))) {
      throw new Error('No event found to reschedule with given details');
    }

    const originalEvent = events[0];

    const descriptions = this.getDescriptions([originalEvent]);
    if (!specificTimeGiven && descriptions.length > 0 && descriptions[0].flexible) {
      // TODO: should we first check descriptions[0].startDateRange is > today and otherwise set start to today?
      startOfRangeToRescheduleTo = descriptions[0].startDateRange;
      endOfRangeToRescheduleTo = descriptions[0].endDateRange;
    }

    const updatedDescription = (descriptions.length > 0) ? JSON.parse(descriptions[0].description) : {};
    updatedDescription.startDateRange = startOfRangeToRescheduleTo;
    updatedDescription.endDateRange = endOfRangeToRescheduleTo;

    await GOOGLE.setDescription(organiserToken, originalEvent, JSON.stringify(updatedDescription));

    const eventEndTime = new Date(events[0].end.dateTime).toISOString();

    let attendeeEmails = [];
    if (originalEvent.attendees) {
      attendeeEmails = originalEvent.attendees.map((person) => person.email);
    }

    // find new time for event using scheduler
    const freeTimes = [];
    const eventDuration = DateTime.fromISO(eventEndTime)
        .diff(DateTime.fromISO(new Date(events[0].start.dateTime).toISOString()));

    const startDate = startOfRangeToRescheduleTo;
    const endDate = endOfRangeToRescheduleTo;

    console.log('STARTDATE ENDDATE ***********');
    console.log(startDate);
    console.log(endDate);
    console.log('*****************************');

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

      // TODO: change minBreakLength to from input
      const minBreakLength = Duration.fromObject({minutes: 15});

      // Format busy times and then get free slots from the provided busy times
      const busyTimes = await GOOGLE.getBusySchedule(token, startDate, endDate);
      if (busyTimes) {
        freeTimes
            .push(SCHEDULER.getFreeSlots((busyTimes.map((e) => [e.start, e.end])), startDate, endDate, minBreakLength));
      }

      // check if history frequency in db for this user has been initialised (if not wait and try again)
      const histFreq = await this.getHistFreq(token, category, email);
      if (histFreq == null) {
        return {
          // tell user hist freqs are still being initialised
          msg: 1,
        };
      }
      histFreqs.push(histFreq);
    }
    // Using free times find a meeting slot and get the choice
    const chosenSlot = await SCHEDULER.findMeetingSlot(freeTimes, eventDuration, constraints, histFreqs);
    if (!chosenSlot) {
      // no time slot found
      // throw new Error('No meeting slot found');
      return {
        // tell user hist freqs are still being initialised
        msg: 2,
      };
    }

    console.log('CHOSENSLOT*********');
    console.log(chosenSlot);
    console.log(chosenSlot.start);
    console.log(chosenSlot.end);
    console.log('********************');

    // reschedule meeting to this new time
    await GOOGLE.updateMeeting(organiserToken, originalEvent, chosenSlot.start, chosenSlot.end, null);

    return chosenSlot;
  },

  async rescheduleSpecific(email, name, date, startTime, endTime) {
    const token = JSON.parse(await DATABASE.getToken(email));
    const startTimeISO = date + 'T' + startTime;
    const endTimeISO = date + 'T' + endTime;
    const startDateTime = DateTime.fromISO(startTimeISO);
    const endDateTime = DateTime.fromISO(endTimeISO);

    const event = await GOOGLE.getEventById(token, lastEventId);
    await GOOGLE.updateMeeting(token, event.data, startDateTime, endDateTime, name);
  },

  async cancelLastBookedMeeting(email) {
    const token = JSON.parse(await DATABASE.getToken(email));
    console.log('cancelling event: ', lastEventId);
    await GOOGLE.cancelEvent(token, lastEventId);
  },

};
