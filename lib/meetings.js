const {DateTime, Duration} = require('luxon');
const TIME = require('./time.js');
const DIALOGFLOW = require('./dialogflow.js');
const DATABASE = require('./database.js');
const GOOGLE = require('./google.js');
const SCHEDULER = require('../src/scheduler.js');

// change histFreqLifetime to change how often the hist freq is recalculated
const HISTFREQLIFETIME = Duration.fromObject({days: 5});
let lastEventId = null;
const TODAY = DateTime.local();
const YESTERDAY = DateTime.local().minus(Duration.fromObject({days: 1}));
const ONEMONTHAGO = TODAY.minus(Duration.fromObject({days: 31}));
const NUM_CATEGORIES = 2;

const context = {
  /** TODO: Comment
   * @param {String} googleEmail: The google email.
   * @param {Array} days: constrainted days.
   * @param {Object} times: constrainted times.
   * @return {number} A list of meetings for the following week.
   */
  async setContraints(googleEmail, days, times) {
    // Check if a user with the provided details existing in the database
    if (!await DATABASE.userExists(googleEmail)) {
      throw new Error(`${googleEmail} is not signed in`);
    }

    // Set the constraints in the database
    for (let i = 0; i < 7; i++) {
      if (days[i] === 1) {
        for (let j = 0; j < times.length; j++) {
          await DATABASE.setConstraintFromGoogleEmail(googleEmail,
              TIME.normaliseDate(times[j].startTime),
              TIME.normaliseDate(times[j].endTime), i);
        }
      }
    }
  },

  async getHistFreq(token, category, googleEmail) {
    const histFreqInfo = await DATABASE.getFrequenciesForCategoryFromGoogleEmail(googleEmail, category);
    let histFreq = histFreqInfo.histFreq;
    if (!histFreqInfo.timestamp || TODAY.diff(DateTime.fromISO(histFreqInfo.timestamp), ['minutes']) > HISTFREQLIFETIME) {
      console.log('UPDATING OUTDATED HISTORY FREQUNCIES');
      // if out of date, recalculate hist freq and update in db
      let lastMonthHist = await GOOGLE.getMeetings(token, ONEMONTHAGO.toISO(), YESTERDAY.toISO());
      lastMonthHist = lastMonthHist.map((e) => [e.start.dateTime, e.end.dateTime, e.summary]);
      const categorisedSchedule = await SCHEDULER.getCategorisedSchedule(lastMonthHist);
      histFreq = await SCHEDULER.generateUserHistory(categorisedSchedule, category);
      await DATABASE.setFrequenciesForCategoryFromGoogleEmail(googleEmail, category, histFreq);
    }
    return histFreq;
  },
  /**
   * TODO: Comment
   * @param {String} title
   * @param {Array} slackEmails
   * @param {String} startDateRangeISO
   * @param {String} endDateRangeISO
   * @param {boolean} flexible
   * @param {number} duration
   * @return {Promise<*|{msg: string}>}
   */

  async schedule(title, googleEmails, startDateRangeISO, endDateRangeISO, flexible, duration) {
    const freeTimes = [];
    const constraints = [];
    const histFreqs = [];
    let category;

    if (!title || title === '') {
      // assume event is work related by default
      category = 1;
    } else {
      category = await DIALOGFLOW.getCategory(title);
    }

    // If duration is not specified, use default duration of one hour (60 minutes)
    const eventDuration = Duration.fromObject({minutes: (duration || 60)});

    const tokens = [];

    // make sure start date time is after current time!
    startDateRangeISO = (DateTime.fromISO(startDateRangeISO) > TODAY) ? startDateRangeISO : TODAY.toISO();

    for (const email of googleEmails) {
      // Check if a user with the provided details existing in the database
      if (!await DATABASE.userExists(email)) {
        throw new Error(`${email} is not signed in`);
      }

      // Get tokens from the database
      const token = JSON.parse(await DATABASE.getTokenFromGoogleEmail(email));
      tokens.push(token);

      // console.log('flexible ', flexible);
      if (flexible) {
        // Retrieve user constraints in format: [{startTime: ISO Date/Time String, endTime: ISO Date/Time String}],
        const weekConstraints = await DATABASE.getConstraintsFromGoogleEmail(email);

        // Generate constraints in format the scheduler takes in
        const generatedConstraints = SCHEDULER.generateConstraints(weekConstraints, startDateRangeISO, endDateRangeISO);

        if (generatedConstraints.length !== 0) {
          // console.log('constraints: ', generatedConstraints.map((interval)=>[interval[0].toString(), interval[1].toString()]));
          constraints.push(generatedConstraints);
        }
        // TODO: change minBreakLength to from input
        const minBreakLength = Duration.fromObject({minutes: 15});

        // Format busy times and then get free slots from the provided busy times
        const data = await GOOGLE.getBusySchedule(token, startDateRangeISO, endDateRangeISO);
        if (data) freeTimes.push(SCHEDULER.getFreeSlots((data.map((e) => [e.start, e.end])), startDateRangeISO, endDateRangeISO, minBreakLength));

        const histFreq = await this.getHistFreq(token, category, email);
        if (histFreq == null) {
          throw new Error('History frequencies not found');
        }
        histFreqs.push(histFreq);
        // console.log('now: ', await DATABASE.getFrequenciesForCategoryFromGoogleEmail(email, category));
      }
    }
    // TODO: generate free between: x and y on every required day

    // Using free times find a meeting slot and get the choice
    let chosenSlot;
    if (flexible) {
      chosenSlot = await SCHEDULER.findMeetingSlot(freeTimes, eventDuration, constraints, histFreqs);
    } else {
      chosenSlot = {
        'start': startDateRangeISO,
        'end': endDateRangeISO,
      };
    }
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
      startDateRange: startDateRangeISO,
      endDateRange: endDateRangeISO,
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
   * @param {number} googleEmail The google email.
   * @return {number} A list of meetings for the following week.
   */
  async getMeetings(googleEmail) {
    try {
      // Check if a user with the provided details existing in the database
      if (!await DATABASE.userExists(googleEmail)) {
        console.log('error: ' + googleEmail + ' is not signed in');
        return;
      }

      // Get tokens from the database
      const token = JSON.parse(await DATABASE.getTokenFromGoogleEmail(googleEmail));
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
   * TODO: Temporarily tp, will move to 'reschedule'
   * @param {String} googleEmail
   * @param {String} oldTitle
   * @param {String} oldDateTimeISO
   * @param {String} newStartDateRangeISO
   * @param {String} newEndDateRangeISO
   * @param {String} newStartTimeRangeISO
   * @param {String} newEndTimeRangeISO
   * @param {String} newDayOfWeek
   * @return {Promise<null>}
   */
  async tp(googleEmail, oldTitle, oldDateTimeISO, newStartDateRangeISO, newEndDateRangeISO,
      newStartTimeRangeISO, newEndTimeRangeISO, newDayOfWeek) {
    // Check if the user is signed in
    if (!await DATABASE.userExists(googleEmail)) {
      throw new Error(`${googleEmail} is not signed in`);
    }

    // Get organiser's Google Calendar token from the database
    const organiserToken = JSON.parse(await DATABASE.getTokenFromGoogleEmail(googleEmail));

    let events;
    if (oldDateTimeISO) {
      // Search for an event with the given date.
      events = await GOOGLE.getEvents(organiserToken, oldDateTimeISO);
    } else if (title) {
      // Search for an event with the given title, as no event start time has been provided.
      events = await GOOGLE.getEventByName(organiserToken, oldTitle);
    }

    if (!events || events.length === 0 ||
     (oldDateTimeISO && !TIME.compareTime(events[0].start.dateTime, oldDateTimeISO))) {
      // If no event is found with the given details, return this information
      throw new Error('No event found to reschedule with given details');
    }

    // Understand whether event is 'work', 'leisure', etc. given the event title
    // const category = await DIALOGFLOW.getCategory(events[0].summary);

    // TODO: Rest of the function.

    return null;
  },

  /**
   * TODO: Comment
   * @param {String} eventStartTimeISO
   * @param {String} title
   * @param {String} organiserGoogleEmail
   * @param {String} startOfRangeToRescheduleToISO
   * @param {String} endOfRangeToRescheduleToISO
   * @param {boolean} specificTimeGiven
   * @return {Promise<{msg: number}>}
   */
  async reschedule(eventStartTimeISO, title, organiserGoogleEmail, startOfRangeToRescheduleToISO,
      endOfRangeToRescheduleToISO, specificTimeGiven) {
    const constraints = [];
    const histFreqs = [];

    // check organiser of event (the person trying to reschedule it) is
    // signed in and check they are the organiser
    if (!await DATABASE.userExists(organiserGoogleEmail)) {
      throw new Error(`${organiserGoogleEmail} is not signed in`);
    }
    // Get organiser's token from the database
    const organiserToken = JSON.parse(await DATABASE.getTokenFromGoogleEmail(organiserGoogleEmail));

    let events;

    if (eventStartTimeISO) {
      // Search for an event with the given date, as no meeting title has been provided
      events = await GOOGLE.getEvents(organiserToken, eventStartTimeISO);
    } else if (title) {
      // Search for an event with the given title, as no event start time has been provided
      events = await GOOGLE.getEventByName(organiserToken, title);
    }

    const category = await DIALOGFLOW.getCategory(events[0].summary);

    // If no event is found with the given details, return this information
    if (!events || events.length === 0 ||
     (eventStartTimeISO && !TIME.compareTime(events[0].start.dateTime, eventStartTimeISO))) {
      throw new Error('No event found to reschedule with given details');
    }

    const originalEvent = events[0];

    const descriptions = this.getDescriptions([originalEvent]);
    if (!specificTimeGiven && descriptions.length > 0 && descriptions[0].flexible) {
      // TODO: should we first check descriptions[0].startDateRange is > today and otherwise set start to today?
      startOfRangeToRescheduleToISO = descriptions[0].startDateRange;
      endOfRangeToRescheduleToISO = descriptions[0].endDateRange;
    }

    const updatedDescription = (descriptions.length > 0) ? JSON.parse(descriptions[0].description) : {};
    updatedDescription.startDateRange = startOfRangeToRescheduleToISO;
    updatedDescription.endDateRange = endOfRangeToRescheduleToISO;

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

    const startDate = startOfRangeToRescheduleToISO;
    const endDate = endOfRangeToRescheduleToISO;

    // remove organiser from attendees to avoid adding twice
    attendeeEmails.pop();
    attendeeEmails.push(organiserGoogleEmail);

    // populate busyTimes array with all attendees' schedules
    for (const email of attendeeEmails) {
      // Check if a user with the provided details existing in the database
      if (!await DATABASE.userExists(email)) {
        throw new Error(`${email} is not signed in`);
      }
      // Get tokens from the database
      const token = JSON.parse(await DATABASE.getTokenFromGoogleEmail(email));

      // Retrieve user constraints in format: [{startTime: ISO Date/Time String, endTime: ISO Date/Time String}],
      const weekConstraints = await DATABASE.getConstraintsFromGoogleEmail(email);

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
        throw new Error('History frequency not found');
      }
      histFreqs.push(histFreq);
    }
    // Using free times find a meeting slot and get the choice
    const chosenSlot = await SCHEDULER.findMeetingSlot(freeTimes, eventDuration, constraints, histFreqs);
    if (!chosenSlot) {
      throw new Error('Slot not found');
    }

    // reschedule meeting to this new time
    await GOOGLE.updateMeeting(organiserToken, originalEvent, chosenSlot.start, chosenSlot.end);

    return chosenSlot;
  },
  // eslint-disable-next-line require-jsdoc
  async generatePreferences(googleEmail, tokens) {
    let lastMonthHist = await GOOGLE.getMeetings(tokens, ONEMONTHAGO.toISO(), TODAY.toISO());
    lastMonthHist = lastMonthHist.map((e) => [e.start.dateTime, e.end.dateTime, e.summary]);
    const categorisedSchedule = await SCHEDULER.getCategorisedSchedule(lastMonthHist);
    for (let category=0; category < NUM_CATEGORIES; category++) {
      // eslint-disable-next-line no-unused-vars
      const histFreq = await SCHEDULER.generateUserHistory(categorisedSchedule, category);
      // await DATABASE.setFrequenciesForCategoryFromGoogleEmail(googleEmail, category, histFreq);
    }
  },
  async rescheduleToSpecificDateTime(googleEmail, name, date, startTime, endTime) {
    const token = JSON.parse(await DATABASE.getTokenFromGoogleEmail(googleEmail));
    const startTimeISO = date + 'T' + startTime;
    const endTimeISO = date + 'T' + endTime;
    const startDateTime = DateTime.fromISO(startTimeISO);
    const endDateTime = DateTime.fromISO(endTimeISO);
    const event = await GOOGLE.getEventById(token, lastEventId);
    event.data.summary = name;
    await GOOGLE.updateMeeting(token, event.data, startDateTime, endDateTime);
  },

  async cancelLastBookedMeeting(googleEmail) {
    const token = JSON.parse(await DATABASE.getTokenFromGoogleEmail(googleEmail));
    await GOOGLE.cancelEvent(token, lastEventId);
  },

};

module.exports = context;
