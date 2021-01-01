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

  /**
   * TODO:
   * @param {String} token
   * @param {Number} category
   * @param {String} googleEmail
   * @return {Array}
   */
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
      console.log('No event found in time frame');
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
            timeRangesForDaysOfWeek: description.timeRangesForDaysOfWeek,
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
   *
   * @param {DateTime} time
   * @return {string}
   */
  roundTimeSameDay(time) {
    const diffStart = time.diff(time.startOf('minute'));
    const roundedStart = time.plus(diffStart).startOf('minute');
    if (roundedStart.day === time.day) {
      time = roundedStart;
      console.log('(rounding): ' + time.toISO());
    }
    return time.toISO();
  },
  /**
   * TODO: Ali + Sam
   * @param {Array} googleEmails
   * @param {String} title
   * @param {Number} duration
   * @param {String} startDateRangeISO
   * @param {String} endDateRangeISO
   * @param {String} startTimeRangeISO
   * @param {String} endTimeRangeISO
   * @param {Boolean} flexible
   * @param {String} dayOfWeek
   * @param {Boolean} timeRangeSpecified
   * @return {Promise<void>}
   */
  async sp(
      googleEmails,
      title,
      duration,
      startDateRangeISO,
      endDateRangeISO,
      startTimeRangeISO,
      endTimeRangeISO,
      flexible,
      dayOfWeek,
      timeRangeSpecified,
  ) {
    const freeTimes = [];
    const histFreqs = [];
    const tokens = [];

    let category;
    if (!title || title === '') {
      category = 1; // assume event is work related by default
    } else {
      category = await DIALOGFLOW.getCategory(title);
    }

    // If duration is not specified, use default duration of one hour (60 minutes)
    const eventDuration = Duration.fromObject({minutes: (duration || 60)});

    // Ensure start date time is after current time!
    startDateRangeISO = (DateTime.fromISO(startDateRangeISO) > TODAY) ? startDateRangeISO : TODAY.toISO();
    if (startTimeRangeISO === endTimeRangeISO) {
      endTimeRangeISO = DateTime.fromISO(startTimeRangeISO).plus(eventDuration).toISO();
    }
    // round up start and end time ranges to nearest minute on the same day
    startTimeRangeISO = this.roundTimeSameDay(DateTime.fromISO(startTimeRangeISO));
    endTimeRangeISO = this.roundTimeSameDay(DateTime.fromISO(endTimeRangeISO));

    console.log('startTimeRangeISO', startTimeRangeISO, ' end ', endTimeRangeISO);
    const timeRangesForDaysOfWeek = TIME.generateTimeRangesForDaysOfWeek(dayOfWeek, startTimeRangeISO, endTimeRangeISO);
    console.log('timerangespecified: ', timeRangeSpecified, ' timerangefordaysofweek', timeRangesForDaysOfWeek);

    // If the start and end time are the exact same, add duration to the end time

    for (const email of googleEmails) {
      // Check if a user with the provided details existing in the database
      if (!await DATABASE.userExists(email)) {
        throw new Error(`${email} is not signed in`);
      }

      // Get tokens from the database
      const token = JSON.parse(await DATABASE.getTokenFromGoogleEmail(email));
      tokens.push(token);

      if (flexible) {
        // Retrieve user constraints in format: [{startTime: ISO Date/Time String, endTime: ISO Date/Time String}],
        // TODO: would users like their working hours considered even when specifying a time range? -- assume yes
        const fullDay = [{startTime: DateTime.local().startOf('day').toISO(), endTime: DateTime.local().endOf('day').toISO()}];
        let attendeeConstraints = [fullDay, fullDay, fullDay, fullDay, fullDay, fullDay, fullDay];

        if (timeRangeSpecified) {
          attendeeConstraints = timeRangesForDaysOfWeek;
        } else if (category === 1) {
          const workingHours = await DATABASE.getConstraintsFromGoogleEmail(email);
          if (workingHours && workingHours.length !== 0) {
            attendeeConstraints = workingHours;
          }
        }
        // TODO: change minBreakLength to from input
        const minBreakLength = Duration.fromObject({minutes: 0});

        // Format busy times and then get free slots from the provided busy times
        const busyTimes = await GOOGLE.getBusySchedule(token, startDateRangeISO, endDateRangeISO);
        if (busyTimes) {
          freeTimes.push(SCHEDULER.getFreeSlots((busyTimes.map((e) => [e.start, e.end])), startDateRangeISO,
              endDateRangeISO, minBreakLength, attendeeConstraints));
        }

        const histFreq = await this.getHistFreq(token, category, email);
        if (histFreq == null) {
          throw new Error('History frequencies not found');
        }
        histFreqs.push(histFreq);
      }
    }

    let chosenSlot;
    if (flexible) {
      // Using free times find a meeting slot and get the choice
      chosenSlot = await SCHEDULER.findMeetingSlot(freeTimes, eventDuration, histFreqs, category);
    } else {
      console.log('not flexible');
      chosenSlot = {'start': TIME.combineDateAndTime(startDateRangeISO, startTimeRangeISO),
        'end': TIME.combineDateAndTime(endDateRangeISO, endTimeRangeISO)};
    }

    if (!chosenSlot) {
      console.log('ERROR: No meeting slot found');
      return {msg: 2};
    }

    const description = {
      flexible: flexible,
      category: category,
      startDateRange: startDateRangeISO,
      endDateRange: endDateRangeISO,
      timeRangesForDaysOfWeek: timeRangesForDaysOfWeek,
    };

    // create meeting event in calendars of team members
    const response = await GOOGLE.createMeeting(tokens[0],
     title !== '' ? title : `Maia Event: ${DateTime.fromISO(chosenSlot.start).toLocaleString(DateTime.DATE_MED)}`,
     chosenSlot.start,
     chosenSlot.end,
     googleEmails,
     JSON.stringify(description),
    );

    lastEventId = response.data.id;
    return chosenSlot;
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
   * @param {String} dateRangeSpecified
   * @param {String} timeRangeSpecified
   * @param {Boolean} flexible
   * @return {Promise<*>}
   */
  async tp(
      googleEmail,
      oldTitle,
      oldDateTimeISO,
      newStartDateRangeISO,
      newEndDateRangeISO,
      newStartTimeRangeISO,
      newEndTimeRangeISO,
      newDayOfWeek,
      dateRangeSpecified,
      timeRangeSpecified,
      flexible= true,
  ) {
    // Check whether the user is signed in.
    if (!await DATABASE.userExists(googleEmail)) {
      throw new Error(`${googleEmail} is not signed in`);
    }

    // Get organiser's Google Calendar token from the database
    const organiserToken = JSON.parse(await DATABASE.getTokenFromGoogleEmail(googleEmail));

    let events;
    if (oldDateTimeISO) {
      events = await GOOGLE.getEvents(organiserToken, oldDateTimeISO); // Search for an event with the given date.
    } else if (oldTitle) {
      events = await GOOGLE.getEventByName(organiserToken, oldTitle); // Search for an event by title.
    }

    if (!events || events.length === 0 ||
     (oldDateTimeISO && !TIME.compareTime(events[0].start.dateTime, oldDateTimeISO))) {
      // If no event is found with the given details, throw this error.
      throw new Error('No event found to reschedule with given details');
    }

    const oldEvent = events[0];

    // Understand whether event is 'work', 'leisure', etc. given the event title
    const category = await DIALOGFLOW.getCategory(events[0].summary);

    // round up start and end time ranges to nearest minute on the same day
    newStartTimeRangeISO = this.roundTimeSameDay(DateTime.fromISO(newStartTimeRangeISO));
    newEndTimeRangeISO = this.roundTimeSameDay(DateTime.fromISO(newEndTimeRangeISO));

    // If the start and end time are the exact same, add duration to the end time
    if (newStartTimeRangeISO === newEndTimeRangeISO) {
      newEndTimeRangeISO = DateTime.fromISO(newStartTimeRangeISO).plus(eventDuration).toISO();
      const updatedTimeRange = TIME.generateTimeRangeFromGoogleEvent(oldEvent, newStartTimeRangeISO, newEndTimeRangeISO);
      newStartTimeRangeISO = updatedTimeRange.start;
      newEndTimeRangeISO = updatedTimeRange.end;
    }

    // TODO: Attendees, do we need to do pop() then push(googleEmail)???
    let attendeeGoogleEmails = [googleEmail];
    if (oldEvent.attendees) {
      attendeeGoogleEmails = oldEvent.attendees.map((person) => person.email);
    }

    const eventStartDateTime = DateTime.fromISO(oldEvent.start.dateTime);
    const eventEndDateTime = DateTime.fromISO(oldEvent.end.dateTime);
    const eventDuration = eventEndDateTime.diff(eventStartDateTime);
    const descriptionJson = this.getDescriptions([oldEvent])[0];
    console.log(descriptionJson);
    let timeRangesForDaysOfWeek = null;

    if (timeRangeSpecified) {
      timeRangesForDaysOfWeek = timeRangesForDaysOfWeek = TIME.generateTimeRangesForDaysOfWeek(
          newDayOfWeek, newStartTimeRangeISO, newEndTimeRangeISO);
    }
    if (descriptionJson) {
      const description = JSON.parse(descriptionJson.description);
      // if time range is not specified => use maia managed time range
      if (!timeRangeSpecified) {
        timeRangesForDaysOfWeek = descriptionJson.timeRangesForDaysOfWeek;
      } else {
        // update to new time range calculated before
        description.timeRangesForDaysOfWeek = timeRangesForDaysOfWeek;
      }
      // if date range is not specified => use maia managed date range
      if (!dateRangeSpecified) {
        const prevDescStartDateRange = DateTime.fromISO(descriptionJson.startDateRange);
        const prevDescEndDateRange = DateTime.fromISO(descriptionJson.endDateRange);
        const twoHoursFromNow = TODAY.plus({hours: 2}).startOf('hour');
        newStartDateRangeISO = DateTime.max(prevDescStartDateRange, twoHoursFromNow).toISO();
        newEndDateRangeISO = (prevDescEndDateRange > TODAY) ? descriptionJson.endDateRange : newEndDateRangeISO;
      } else {
        description.startDateRange = newStartDateRangeISO;
        description.endDateRange = newEndDateRangeISO;
      }
      // Update description of maia managed events according to the how it's rescheduled.
      await GOOGLE.setDescription(organiserToken, oldEvent, JSON.stringify(description));
    }

    console.log('flex', flexible, attendeeGoogleEmails);
    const freeTimes = [];
    const histFreqs = [];

    for (const attendeeGoogleEmail of attendeeGoogleEmails) {
      if (!await DATABASE.userExists(attendeeGoogleEmail)) throw new Error(`${attendeeGoogleEmail} is not signed in`);

      if (flexible) {
        console.log('flexible');
        const attendeeGoogleToken = JSON.parse(await DATABASE.getTokenFromGoogleEmail(attendeeGoogleEmail));
        const fullDay = [{startTime: DateTime.local().startOf('day').toISO(), endTime: DateTime.local().endOf('day').toISO()}];
        let attendeeConstraints = [fullDay, fullDay, fullDay, fullDay, fullDay, fullDay, fullDay];

        // TODO: Fix for maia managed without timerangespecified in the past
        if ((!descriptionJson && timeRangeSpecified) || descriptionJson) {
          console.log('0');
          attendeeConstraints = timeRangesForDaysOfWeek;
        } else if (category === 1) {
          console.log('1');
          const workingHours = await DATABASE.getConstraintsFromGoogleEmail(attendeeGoogleEmail);
          if (workingHours && workingHours.length !== 0) {
            attendeeConstraints = workingHours;
          }
        }
        console.log('2', attendeeConstraints);
        // TODO: change minBreakLength to from input
        const minBreakLength = Duration.fromObject({minutes: 0});

        // Format busy times and then get free slots from the provided busy times
        const busyTimes = await GOOGLE.getBusySchedule(attendeeGoogleToken, newStartDateRangeISO, newEndDateRangeISO);
        if (busyTimes) {
          freeTimes.push(SCHEDULER.getFreeSlots((busyTimes.map((e) => [e.start, e.end])), newStartDateRangeISO,
              newEndDateRangeISO, minBreakLength, attendeeConstraints));
        }

        const histFreq = await this.getHistFreq(attendeeGoogleToken, category, attendeeGoogleEmail);
        if (histFreq == null) {
          throw new Error('History frequency not found');
        }
        histFreqs.push(histFreq);
      }
    }
    let chosenSlot;
    if (flexible) {
      // Using free times find a meeting slot and get the choice
      chosenSlot = await SCHEDULER.findMeetingSlot(freeTimes, eventDuration, histFreqs, category);
    } else {
      console.log('not flexible');
      chosenSlot = {'start': TIME.combineDateAndTime(newStartDateRangeISO, newStartTimeRangeISO),
        'end': TIME.combineDateAndTime(newEndDateRangeISO, newEndTimeRangeISO)};
    }

    console.log('chosen slot', chosenSlot);
    if (!chosenSlot) {
      throw new Error('Slot not found');
    }

    // reschedule meeting to this new time
    await GOOGLE.updateMeeting(organiserToken, oldEvent, chosenSlot.start, chosenSlot.end);

    return chosenSlot;
  },

  /**
   * TODO:
   * @param {String} googleEmail
   * @param {Array} categorisedSchedule
   * @param {Number} category
   * @return {Promise<void>}
   */
  async generateHistFreqForCategory(googleEmail, categorisedSchedule, category) {
    const histFreq = await SCHEDULER.generateUserHistory(categorisedSchedule, category);
    await DATABASE.setFrequenciesForCategoryFromGoogleEmail(googleEmail, category, histFreq);
  },

  /**
   * TODO:
   * @param {String} googleEmail
   * @param {String} tokens
   * @return {Promise<void>}
   */
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

  /**
   * TODO: Don't you also need to update the description of the event here?
   * @param {String} googleEmail
   * @param {String} name
   * @param {String} date
   * @param {String} startTime
   * @param {String} endTime
   * @return {Promise<void>}
   */
  async rescheduleToSpecificDateTime(googleEmail, name, date, startTime, endTime) {
    const token = JSON.parse(await DATABASE.getToken(googleEmail));
    const startTimeISO = date + 'T' + startTime;
    const endTimeISO = date + 'T' + endTime;
    const startDateTime = DateTime.fromISO(startTimeISO);
    const endDateTime = DateTime.fromISO(endTimeISO);
    const event = await GOOGLE.getEventById(token, lastEventId);
    event.summary = name;
    await GOOGLE.updateMeeting(token, event.data, startDateTime.toISO(), endDateTime.toISO());
  },

  /**
   * TODO: Someone?
   * @param {String} googleEmail
   * @return {Promise<void>}
   */
  async cancelLastBookedMeeting(googleEmail) {
    const token = JSON.parse(await DATABASE.getTokenFromGoogleEmail(googleEmail));
    await GOOGLE.cancelEvent(token, lastEventId);
  },

};

module.exports = context;
