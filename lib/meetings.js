const { DateTime, Duration } = require("luxon");
const TIME = require("./time.js");
const DIALOGFLOW = require("./dialogflow.js");
const DATABASE = require("./database.js");
const GOOGLE = require("./google.js");
const SCHEDULER = require("../src/scheduler.js");

// change histFreqLifetime to change how often the hist freq is recalculated
const HIST_FREQ_LIFETIME = Duration.fromObject({ days: 5 });
const TODAY = DateTime.local();
const YESTERDAY = DateTime.local().minus(Duration.fromObject({ days: 1 }));
const ONE_MONTH_AGO = TODAY.minus(Duration.fromObject({ months: 1 }));
const NUM_CATEGORIES = 2;

let lastEventId = null;

const context = {
  /**
   * Set the working hours of the user with the given google email to the times on the days given
   *
   * @param {string} googleEmail - email identifying the user
   * @param {Array} days - days to set constraints on
   * @param {Array} times - times to set constraints on
   * @return {number} A list of meetings for the following week.
   */
  async setContraints(googleEmail, days, times) {
    // Check if a user with the provided details existing in the database
    if (!(await DATABASE.userExists(googleEmail))) {
      throw new Error(`${googleEmail} is not signed in`);
    }

    // Set the constraints in the database
    for (let i = 0; i < 7; i++) {
      if (days[i] === 1) {
        for (let j = 0; j < times.length; j++) {
          await DATABASE.setConstraintForDayFromGoogleEmail(
            googleEmail,
            TIME.normaliseDate(times[j].startTime),
            TIME.normaliseDate(times[j].endTime),
            i
          );
        }
      }
    }
  },

  /**
   * Return the the frequency table for the user with the google email given and the category specified
   *
   * @param {string} token - authorization token of Google account
   * @param {number} category - whether the event is leisure, work, etc.
   * @param {string} googleEmail - email identifying the user
   * @return {Array} representing the history frequencies
   */
  async getHistFreq(token, category, googleEmail) {
    const histFreqInfo = await DATABASE.getFrequenciesForCategoryFromGoogleEmail(
      googleEmail,
      category
    );
    let histFreq = histFreqInfo.histFreq;
    if (
      !histFreqInfo.timestamp ||
      TODAY.diff(DateTime.fromISO(histFreqInfo.timestamp), ["minutes"]) >
        HIST_FREQ_LIFETIME
    ) {
      console.log("UPDATING OUTDATED HISTORY FREQUNCIES");
      // if out of date, recalculate hist freq and update in db
      let lastMonthHist = await GOOGLE.getMeetings(
        token,
        ONE_MONTH_AGO.toISO(),
        YESTERDAY.toISO()
      );
      lastMonthHist = lastMonthHist.map((e) => [
        e.start.dateTime,
        e.end.dateTime,
        e.summary,
      ]);
      const categorisedSchedule = await SCHEDULER.getCategorisedSchedule(
        lastMonthHist
      );
      histFreq = await SCHEDULER.generateUserHistory(
        categorisedSchedule,
        category
      );
      await DATABASE.setFrequenciesForCategoryFromGoogleEmail(
        googleEmail,
        category,
        histFreq
      );
    }
    return histFreq;
  },

  /**
   * @param {number} googleEmail - The google email.
   * @return {number} - A list of meetings for the following week.
   */
  async getMeetings(googleEmail) {
    try {
      // Check if a user with the provided details existing in the database
      if (!(await DATABASE.userExists(googleEmail))) {
        console.log("error: " + googleEmail + " is not signed in");
        return;
      }

      // Get tokens from the database
      const token = JSON.parse(
        await DATABASE.getTokenFromGoogleEmail(googleEmail)
      );
      const today = new Date();
      // End date in one week for now
      const endDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 7
      );
      const events = await GOOGLE.getMeetings(
        token,
        today.toISOString(),
        endDate.toISOString()
      );

      if (!events || events.length === 0) {
        // console.log('No event found in time frame');
        return null;
      }
      // could possible have the same summary multiple times
      const eventDict = events.map((event) => [
        event.summary,
        event.start.dateTime,
        event.end.dateTime,
      ]);
      return eventDict;
    } catch (error) {
      console.error(error);
    }
  },

  /**
   * Return the descriptions for the events given
   *
   * @param {Array} events - list of event objects
   * @return {Array} list of descriptions
   */
  getDescriptions: (events) => {
    if (!events || events.length === 0) {
      console.log("No event found in time frame");
      return null;
    }
    const eventsWithDescription = [];
    // could possible have the same summary multiple times
    events.forEach((element) => {
      try {
        const description = JSON.parse(element.description);
        if (
          description.flexible !== null &&
          description.category !== null &&
          description.startDateRange &&
          description.endDateRange
        ) {
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
   * @param {boolean} timeRangeSpecified - todo
   * @param {Array} timeRangesForDaysOfWeek -todo
   * @param {string} attendeeGoogleEmail -todo
   * @param {number} category -todo
   * @param {object} descriptionJson -todo
   * @param {number} newDayOfWeek -todo
   * @return {Array} -
   */
  async getTimeRangesForDaysOfWeek(
    timeRangeSpecified,
    timeRangesForDaysOfWeek,
    attendeeGoogleEmail,
    category,
    descriptionJson,
    newDayOfWeek
  ) {
    console.log('---getTimeRangesForDaysOfWeek---');
    const fullDay = [
      {
        startTime: TODAY.startOf('day').toISO(),
        endTime: TODAY.endOf('day').toISO(),
      },
    ];
    let attendeeConstraints = [
      fullDay,
      fullDay,
      fullDay,
      fullDay,
      fullDay,
      fullDay,
      fullDay,
    ];
    if (timeRangeSpecified && timeRangesForDaysOfWeek.length > 0) {
      attendeeConstraints = timeRangesForDaysOfWeek;
    }
    // if no timerangespecified now or the event is maia managed without timerangespecified in the past then use
    // working hours for work events
    else if (category === 1 || category === -1) {
      const workingHours = await DATABASE.getConstraintsFromGoogleEmail(
        attendeeGoogleEmail
      );
      if (newDayOfWeek.length > 0) {
        // intersect timeRangesForDaysOfWeek with working hours since only the day of week has been specified
        // -- no time within
        const newTimeRangesForDaysOfWeek = [];
        for (let day = 0; day < timeRangesForDaysOfWeek.length; day++) {
          if (timeRangesForDaysOfWeek[day].length === 0)
            newTimeRangesForDaysOfWeek.push([]);
          else {
            newTimeRangesForDaysOfWeek.push(workingHours[day]);
          }
        }
        console.log("newTimeRangesForDaysOfWeek", newTimeRangesForDaysOfWeek);
        attendeeConstraints = newTimeRangesForDaysOfWeek;
      } else if (
        descriptionJson &&
        descriptionJson.timeRangesForDaysOfWeek.length > 0
      ) {
        attendeeConstraints = descriptionJson.timeRangesForDaysOfWeek;
      } else if (workingHours && workingHours.length !== 0) {
        attendeeConstraints = workingHours;
      }
    }
    console.log("attendeeConstraints: ", attendeeConstraints);
    return attendeeConstraints;
  },

  /**
   * TODO: Ali + Sam
   *
   * @param {Array} googleEmails -
   * @param {string} title -
   * @param {number} duration -
   * @param {string} startDateRangeISO -
   * @param {string} endDateRangeISO -
   * @param {string} startTimeRangeISO -
   * @param {string} endTimeRangeISO -
   * @param {boolean} flexible -
   * @param {string} dayOfWeek -
   * @param {boolean} timeRangeSpecified -
   * @return {Promise<void>}
   */
  async schedule(
    googleEmails,
    title,
    duration,
    startDateRangeISO,
    endDateRangeISO,
    startTimeRangeISO,
    endTimeRangeISO,
    flexible,
    dayOfWeek,
    timeRangeSpecified
  ) {
    const freeTimes = [];
    const histFreqs = [];
    const tokens = [];

    let category;
    if (!title || title === "") {
      category = 1; // assume event is work related by default
    } else {
      category = (await DIALOGFLOW.getCategory(title)) === 0 ? 0 : 1;
    }

    // If duration is not specified, use default duration of one hour (60 minutes)
    const eventDuration = Duration.fromObject({ minutes: duration || 60 });

    // Ensure start date time is after current time!
    startDateRangeISO =
      DateTime.fromISO(startDateRangeISO) > TODAY
        ? startDateRangeISO
        : TODAY.toISO();
    if (startTimeRangeISO === endTimeRangeISO) {
      endTimeRangeISO = DateTime.fromISO(startTimeRangeISO)
        .plus(eventDuration)
        .toISO();
    }
    // round up start and end time ranges to nearest minute on the same day
    startTimeRangeISO = TIME.roundTimeToSameDay(startTimeRangeISO);
    endTimeRangeISO = TIME.roundTimeToSameDay(endTimeRangeISO);

    console.log(
      "startTimeRangeISO",
      startTimeRangeISO,
      " end ",
      endTimeRangeISO
    );
    let timeRangesForDaysOfWeek = [];
    if (timeRangeSpecified || dayOfWeek.length > 0) {
      timeRangesForDaysOfWeek = TIME.generateTimeRangesForDaysOfWeek(
        dayOfWeek,
        startTimeRangeISO,
        endTimeRangeISO
      );
    }
    console.log("timeRangeSpecified: ", timeRangeSpecified);
    console.log("timeRangeForDaysOfWeek", timeRangesForDaysOfWeek);

    // If the start and end time are the exact same, add duration to the end time

    for (const email of googleEmails) {
      // Check if a user with the provided details existing in the database
      if (!(await DATABASE.userExists(email))) {
        throw new Error(`${email} is not signed in`);
      }

      // Get tokens from the database
      const token = JSON.parse(await DATABASE.getTokenFromGoogleEmail(email));
      tokens.push(token);

      if (flexible) {
        // Retrieve user constraints in format: [{startTime: ISO Date/Time String, endTime: ISO Date/Time String}],
        // TODO: would users like their working hours considered even when specifying a time range? -- assume yes

        const attendeeConstraints = await this.getTimeRangesForDaysOfWeek(
          timeRangeSpecified,
          timeRangesForDaysOfWeek,
          email,
          category,
          null,
          dayOfWeek
        );

        // TODO: change minBreakLength to from input
        let minBreakLength = Duration.fromObject({ minutes: 0 });
        if (category === 1 || category === -1) {
          // only set break length for work events
          const mins = await DATABASE.getMinBreakLength(email);
          console.log('min break length: ', mins);
          minBreakLength = Duration.fromObject({minutes: mins});
        }

        // Format busy times and then get free slots from the provided busy times
        const busyTimes = await GOOGLE.getBusySchedule(
          token,
          startDateRangeISO,
          endDateRangeISO
        );
        if (busyTimes) {
          freeTimes.push(
            SCHEDULER.getFreeSlots(
              busyTimes.map((e) => [e.start, e.end]),
              startDateRangeISO,
              endDateRangeISO,
              minBreakLength,
              attendeeConstraints
            )
          );
        }

        const histFreq = await this.getHistFreq(token, category, email);
        if (histFreq == null) {
          throw new Error("History frequencies not found");
        }
        histFreqs.push(histFreq);
      }
    }

    let chosenSlot;
    if (flexible) {
      // Using free times find a meeting slot and get the choice
      chosenSlot = await SCHEDULER.findMeetingSlot(
        freeTimes,
        eventDuration,
        histFreqs,
        category
      );
    } else {
      console.log("not flexible");
      chosenSlot = {
        start: TIME.combineDateAndTime(startDateRangeISO, startTimeRangeISO),
        end: TIME.combineDateAndTime(endDateRangeISO, endTimeRangeISO),
      };
    }

    if (!chosenSlot) {
      console.log("ERROR: No meeting slot found");
      return { msg: 2 };
    }

    const description = {
      flexible: flexible,
      category: category,
      startDateRange: startDateRangeISO,
      endDateRange: endDateRangeISO,
      timeRangesForDaysOfWeek: timeRangeSpecified
        ? timeRangesForDaysOfWeek
        : [],
    };

    // create meeting event in calendars of team members
    const response = await GOOGLE.createMeeting(
      tokens[0],
      title !== ""
        ? title
        : `Maia Event: ${DateTime.fromISO(chosenSlot.start).toLocaleString(
            DateTime.DATE_MED
          )}`,
      chosenSlot.start,
      chosenSlot.end,
      googleEmails,
      flexible ? JSON.stringify(description) : null
    );

    lastEventId = response.data.id;
    return chosenSlot;
  },

  /**
   * TODO: Temporarily tp, will move to 'reschedule'
   *
   * @param {string} googleEmail -
   * @param {string} oldTitle -
   * @param {string} oldDateTimeISO -
   * @param {string} newStartDateRangeISO -
   * @param {string} newEndDateRangeISO -
   * @param {string} newStartTimeRangeISO -
   * @param {string} newEndTimeRangeISO -
   * @param {string} newDayOfWeek -
   * @param {string} dateRangeSpecified -
   * @param {string} timeRangeSpecified -
   * @param {boolean} flexible -
   * @return {Promise<*>} -
   */
  async reschedule(
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
    flexible = true
  ) {
    console.log("-------reschedule--------");
    // Check whether the user is signed in.
    if (!(await DATABASE.userExists(googleEmail))) {
      throw new Error(`${googleEmail} is not signed in`);
    }

    // Get organiser's Google Calendar token from the database
    const organiserToken = JSON.parse(
      await DATABASE.getTokenFromGoogleEmail(googleEmail)
    );

    let events;
    if (oldDateTimeISO) {
      events = await GOOGLE.getEvents(organiserToken, oldDateTimeISO); // Search for an event with the given date.
    } else if (oldTitle) {
      events = await GOOGLE.getEventByName(organiserToken, oldTitle); // Search for an event by title.
    }

    if (
      !events ||
      events.length === 0 ||
      (oldDateTimeISO &&
        !TIME.compareTime(events[0].start.dateTime, oldDateTimeISO))
    ) {
      // If no event is found with the given details, throw this error.
      throw new Error("No event found to reschedule with given details");
    }

    const oldEvent = events[0];

    // Understand whether event is 'work', 'leisure', etc. given the event title
    const category =
      (await DIALOGFLOW.getCategory(events[0].summary)) === 0 ? 0 : 1;

    // round up start and end time ranges to nearest minute on the same day
    newStartTimeRangeISO = TIME.roundTimeToSameDay(newStartTimeRangeISO);
    newEndTimeRangeISO = TIME.roundTimeToSameDay(newEndTimeRangeISO);

    const eventStartDateTime = DateTime.fromISO(oldEvent.start.dateTime);
    const eventEndDateTime = DateTime.fromISO(oldEvent.end.dateTime);
    const eventDuration = eventEndDateTime.diff(eventStartDateTime);
    const descriptionJson = this.getDescriptions([oldEvent])[0];
    console.log(descriptionJson);

    // If the start and end time are the exact same, add duration to the end time
    if (newStartTimeRangeISO === newEndTimeRangeISO) {
      newEndTimeRangeISO = DateTime.fromISO(newStartTimeRangeISO)
        .plus(eventDuration)
        .toISO();
    }

    // TODO: Attendees, do we need to do pop() then push(googleEmail)???
    let attendeeGoogleEmails = [googleEmail];
    if (oldEvent.attendees) {
      attendeeGoogleEmails = oldEvent.attendees.map((person) => person.email);
    }

    let timeRangesForDaysOfWeek = [];

    if (timeRangeSpecified || newDayOfWeek.length > 0) {
      console.log("timeRangeSpecified", timeRangeSpecified);
      timeRangesForDaysOfWeek = TIME.generateTimeRangesForDaysOfWeek(
        newDayOfWeek,
        newStartTimeRangeISO,
        newEndTimeRangeISO
      );
    }
    if (descriptionJson && flexible) {
      // update existing description
      const description = JSON.parse(descriptionJson.description);
      // if time range is not specified => use maia managed time range if specified
      if (
        !timeRangeSpecified &&
        descriptionJson.timeRangesForDaysOfWeek.length > 0
      ) {
        timeRangesForDaysOfWeek = descriptionJson.timeRangesForDaysOfWeek;
      } else if (timeRangeSpecified) {
        // update description for this event with new time range calculated before
        description.timeRangesForDaysOfWeek = timeRangesForDaysOfWeek;
      }
      // if date range is not specified => use maia managed date range
      if (!dateRangeSpecified) {
        const prevDescStartDateRange = DateTime.fromISO(
          descriptionJson.startDateRange
        );
        const prevDescEndDateRange = DateTime.fromISO(
          descriptionJson.endDateRange
        );
        const twoHoursFromNow = TODAY.plus({ hours: 2 }).startOf("hour");
        newStartDateRangeISO = DateTime.max(
          prevDescStartDateRange,
          twoHoursFromNow
        ).toISO();
        newEndDateRangeISO =
          prevDescEndDateRange > TODAY
            ? descriptionJson.endDateRange
            : newEndDateRangeISO;
      } else {
        description.startDateRange = newStartDateRangeISO;
        description.endDateRange = newEndDateRangeISO;
      }
      // Update description of maia managed events according to the how it's rescheduled.
      await GOOGLE.setDescription(
        organiserToken,
        oldEvent,
        JSON.stringify(description)
      );
    } else if (flexible) {
      // create description since now event is maia managed
      const description = {
        flexible: flexible,
        category: category,
        startDateRange: newStartDateRangeISO,
        endDateRange: newEndDateRangeISO,
        // since this has not been maia managed before, only set time range if specified here
        timeRangesForDaysOfWeek: timeRangeSpecified
          ? timeRangesForDaysOfWeek
          : [],
      };
      await GOOGLE.setDescription(
        organiserToken,
        oldEvent,
        JSON.stringify(description)
      );
    } else {
      // if not flexible then remove maia management
      await GOOGLE.setDescription(organiserToken, oldEvent, null);
    }
    console.log("flex", flexible, attendeeGoogleEmails);
    const freeTimes = [];
    const histFreqs = [];

    for (const attendeeGoogleEmail of attendeeGoogleEmails) {
      if (!(await DATABASE.userExists(attendeeGoogleEmail)))
        throw new Error(`${attendeeGoogleEmail} is not signed in`);

      if (flexible) {
        const attendeeGoogleToken = JSON.parse(
          await DATABASE.getTokenFromGoogleEmail(attendeeGoogleEmail)
        );
        const attendeeConstraints = await this.getTimeRangesForDaysOfWeek(
          timeRangeSpecified,
          timeRangesForDaysOfWeek,
          attendeeGoogleEmail,
          category,
          descriptionJson,
          newDayOfWeek
        );

        // TODO: change minBreakLength to from input
        const minBreakLength = Duration.fromObject({ minutes: 0 });

        // Format busy times and then get free slots from the provided busy times
        const busyTimes = await GOOGLE.getBusySchedule(
          attendeeGoogleToken,
          newStartDateRangeISO,
          newEndDateRangeISO
        );
        if (busyTimes) {
          freeTimes.push(
            SCHEDULER.getFreeSlots(
              busyTimes.map((e) => [e.start, e.end]),
              newStartDateRangeISO,
              newEndDateRangeISO,
              minBreakLength,
              attendeeConstraints
            )
          );
        }
        const histFreq = await this.getHistFreq(
          attendeeGoogleToken,
          category,
          attendeeGoogleEmail
        );
        if (histFreq == null) {
          throw new Error("History frequency not found");
        }
        histFreqs.push(histFreq);
      }
    }
    let chosenSlot;
    if (flexible) {
      console.log("flexible", flexible);
      // Using free times find a meeting slot and get the choice
      chosenSlot = await SCHEDULER.findMeetingSlot(
        freeTimes,
        eventDuration,
        histFreqs,
        category
      );
    } else {
      console.log("not flexible");
      chosenSlot = {
        start: TIME.combineDateAndTime(
          newStartDateRangeISO,
          newStartTimeRangeISO
        ),
        end: TIME.combineDateAndTime(newEndDateRangeISO, newEndTimeRangeISO),
      };
    }

    console.log("chosen slot", chosenSlot);
    if (!chosenSlot) {
      // TODO: change to a msg -- shouldn't be displayed as an error if no slot is available!
      throw new Error("Slot not found");
    }

    // reschedule meeting to this new time
    await GOOGLE.updateMeeting(
      organiserToken,
      oldEvent,
      chosenSlot.start,
      chosenSlot.end
    );

    return chosenSlot;
  },

  /**
   * TODO:
   *
   * @param {string} googleEmail -
   * @param {Array} categorisedSchedule -
   * @param {number} category -
   * @return {Promise<void>}
   */
  async generateHistFreqForCategory(
    googleEmail,
    categorisedSchedule,
    category
  ) {
    const histFreq = await SCHEDULER.generateUserHistory(
      categorisedSchedule,
      category
    );
    await DATABASE.setFrequenciesForCategoryFromGoogleEmail(
      googleEmail,
      category,
      histFreq
    );
  },

  /**
   * TODO:
   *
   * @param {string} googleEmail -
   * @param {string} tokens -
   * @return {Promise<void>}
   */
  async generatePreferences(googleEmail, tokens) {
    let lastMonthHist = await GOOGLE.getMeetings(
      tokens,
      ONE_MONTH_AGO.toISO(),
      TODAY.toISO()
    );
    lastMonthHist = lastMonthHist.map((e) => [
      e.start.dateTime,
      e.end.dateTime,
      e.summary,
    ]);
    const categorisedSchedule = await SCHEDULER.getCategorisedSchedule(
      lastMonthHist
    );
    for (let category = 0; category < NUM_CATEGORIES; category++) {
      // eslint-disable-next-line no-unused-vars
      const histFreq = await SCHEDULER.generateUserHistory(
        categorisedSchedule,
        category
      );
      // await DATABASE.setFrequenciesForCategoryFromGoogleEmail(googleEmail, category, histFreq);
    }
  },

  /**
   * TODO: Don't you also need to update the description of the event here?
   *
   * @param {string} googleEmail - TODO: Taariq
   * @param {string} name - TODO: Taariq
   * @param {string} date - TODO: Taariq
   * @param {string} startTime - TODO: Taariq
   * @param {string} endTime - TODO: Taariq
   * @return {Promise<void>} - TODO: Taariq
   */
  async rescheduleToSpecificDateTime(
    googleEmail,
    name,
    date,
    startTime,
    endTime
  ) {
    const token = JSON.parse(await DATABASE.getToken(googleEmail));
    const startTimeISO = date + "T" + startTime;
    const endTimeISO = date + "T" + endTime;
    const startDateTime = DateTime.fromISO(startTimeISO);
    const endDateTime = DateTime.fromISO(endTimeISO);
    const event = await GOOGLE.getEventById(token, lastEventId);
    event.summary = name;
    await GOOGLE.updateMeeting(
      token,
      event.data,
      startDateTime.toISO(),
      endDateTime.toISO()
    );
  },

  /**
   * TODO: Someone?
   *
   * @param {string} googleEmail - TODO: Taariq
   * @return {Promise<void>} - TODO: Taariq
   */
  async cancelLastBookedMeeting(googleEmail) {
    const token = JSON.parse(
      await DATABASE.getTokenFromGoogleEmail(googleEmail)
    );
    await GOOGLE.cancelEvent(token, lastEventId);
  },
};

module.exports = context;
