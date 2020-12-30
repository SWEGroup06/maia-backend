const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');
const TIME = require('./time.js');
const {DateTime} = require('luxon');

const mainCreds = JSON.parse(process.env.MAIN_CREDS);
const semanticCreds = JSON.parse(process.env.SEMANTIC_CREDS);

const context = {
  _actionHandlers: {
    /**
     * TODO: Comment
     * @param {Object} fields
     * @return {{people: string[]}}
     */
    schedule: function(fields) {
      /*
       * Output format is an object as follows:
       *    {
       *        flexible: Boolean
       *        time: String Array of either size 1 or 2
       *        people: Array of String
       *        beforeAfterKey: String (either 'before' or 'after')
       *    }
       */

      return ({
        title: fields['meeting-title'].stringValue,
        ...context.parseScheduleRequest(fields),
        duration: context.parseDuration(fields['meeting-length'].structValue),
        people: fields['people'].listValue.values.map((e) => e.stringValue),
        beforeAfterKey: fields['beforeAfterKey'].stringValue,
      });
    },

    /**
     * Returns an object of information parsed from DialogFlow.
     * @param {Object} fields
     * @return {Object} containing either the meeting title or the old event date, as well as
     * a new date for the event to take place.
     */
    reschedule: function(fields) {
      return ({
        meetingTitle: fields['meeting-title'].stringValue,
        oldMeetingDate: context._parseTimeObj(fields['old-meeting-date']).time,
        newMeetingDate: context._parseTimeObj(fields['new-meeting-date']).time,
        beforeAfterKey: fields['beforeAfterKey'].stringValue,
      });
    },

    /**
     * TODO: Ali + Sam
     * @param {Object} fields
     * @return {Object} returns an object of the parsed DialogFlow command.
     */
    tp: function(fields) {
      /**
       * TODO: Delete this comment after we figure it out.
       * What we need to get:
       * - oldDateTime (combine date+time together) *or* oldTitle
       *
       * - startDateRange (if specific day => start of day)
       * - endDateRange   (if specific day => end of day)
       * - either: timeRange *or* specificTime
       * - [optional] dayOfWeek (e.g. weekend, saturday, monday, tuesday, etc.)
       */
      console.log('*** TP, PARAMETER: FIELDS ***');
      console.log(fields);
      console.log('*********');

      let timeRangeSpecified = true;

      if (!fields['new-time-range'].stringValue && !fields['new-specific-time'].stringValue &&
          !fields['new-time-range'].structValue) {
        timeRangeSpecified = false;
      }

      const newDateRange = context._parseDateRange(fields['new-specific-date'], fields['new-date-range']);
      const newTimeRange = context._parseTimeRange(fields['new-specific-time'], fields['new-time-range']);

      return ({
        oldTitle: fields['old-title'].stringValue,
        oldDateTime: TIME.combineDateAndTime(fields['old-date'].stringValue, fields['old-time'].stringValue),

        newStartDateRange: newDateRange.start,
        newEndDateRange: newDateRange.end,

        newStartTimeRange: newTimeRange.start,
        newEndTimeRange: newTimeRange.end,
        timeRangeSpecified: timeRangeSpecified,

        newDayOfWeek: fields['new-day-of-week'].stringValue,
      });
    },

    /**
     * TODO: Comment
     * @param {Object} fields
     * @return {{busyDays: null}}
     */
    constraint: function(fields) {
      return ({
        busyDays: TIME.getBusyDays(fields.dayOfWeek.listValue.values),
        busyTimes: TIME.getBusyTimes(fields['time-period'].listValue.values),
      });
    },

    /**
     * // TODO: Ali
     * @param {Object} fields
     * @return {{}}
     */
    cancel: function(fields) {
      return ({
        meetingTitle: fields.meetingName.stringValue,
        meetingDateTime: TIME.combineDateAndTime(fields.date.stringValue, fields.time.stringValue),
      });
    },
  },

  /**
   * If user specifies a duration for the meeting, return the duration in minutes.
   * If not, return null.
   * @param {Object} meeting: Object specifying unit and duration of meeting.
   * @return {null|number}
   */
  parseDuration(meeting) {
    if (meeting && 'fields' in meeting) {
      const unit = meeting.fields.unit.stringValue;
      const duration = meeting.fields.amount.numberValue;

      if (unit === 'min') {
        // User stated duration in minutes
        return duration;
      }

      if (unit === 'h') {
        // User stated duration in hours
        return duration * 60;
      }
    }

    return null;
  },

  /**
   * Understand whether the user wants to schedule over a range or a specific time.
   * Takes the 'time' object from DialogFlow.
   * @param {Object} time
   * @return {{}} an array of size 2 representing start and end times
   */
  parseScheduleRequest(time) {
    const res = {};
    if (!time) {
      res.error = 'No time found';
      return res;
    }

    let startTime;
    let endTime;

    res.flexible = true;

    if (time) {
      if (time['very-specific-meeting-time'].structValue && time['very-specific-meeting-time'].structValue.fields) {
        /* Where a specific date and time is given (either a specific time like 4pm, or a time of day like evening)
         * Should be in the format: { "date_time": "2020-11-12T19:00:00Z" } (DialogFlow)
         */
        res.flexible = false;

        if (time['very-specific-meeting-time'].structValue.fields.date_time) {
          // this is the case when only a specific time is given e.g. 4pm
          res.time = [time['very-specific-meeting-time'].structValue.fields.date_time.stringValue];
        } else if (time['very-specific-meeting-time'].structValue.fields) {
          // this is the case where a general time of day is given e.g. afternoon, evening
          startTime = time['very-specific-meeting-time'].structValue.fields.startDateTime.stringValue;
          endTime = time['very-specific-meeting-time'].structValue.fields.endDateTime.stringValue;

          res.time = [startTime, endTime];
        }
      } else if (time['very-specific-meeting-time'].stringValue !== '') {
        startTime = DateTime.fromISO(time['very-specific-meeting-time'].stringValue, {zone: 'Europe/Paris'}).toISO();
        endTime = DateTime.fromISO(startTime, {zone: 'Europe/Paris'}).plus({hours: 1}).toISO();

        res.time = [startTime, endTime];
      } else if (time['specific-meeting-time'].stringValue !== '') {
        /* Where a specific date is given, but not a time
         * Should be in the format: 2020-11-13T12:00:00Z (DialogFlow)
         */

        startTime = DateTime.fromISO(time['specific-meeting-time'].stringValue).startOf('day');
        endTime = startTime.endOf('day');

        res.time = [startTime.toISO(), endTime.toISO()];
      } else if (time['meeting-time'].structValue && time['meeting-time'].structValue.fields) {
        /* Where a range of dates is given, e.g. a whole week, month, etc.
         */

        startTime = time['meeting-time'].structValue.fields.startDate.stringValue;
        endTime = time['meeting-time'].structValue.fields.endDate.stringValue;

        res.time = [startTime, endTime];
      }
    }

    return res;
  },

  /**
   * Understands what format time is in after DialogFlow sends it back. Possibilities include:
   *      - one single time (no date)
   *      - one single date and time
   *      - a range of times
   * @param {Object} time: passed in from DialogFlow
   * @return {Object} res: object containing either a time or a range of times
   * @private
   */
  _parseTimeObj(time) {
    const res = {};
    if (!time) {
      res.error = 'No time found';
      return res;
    }
    if (time.structValue) {
      time = time.structValue.fields;
      if (time['date_time']) {
        res.time = [time['date_time'].stringValue];
      }
      if (time['endDate'] && time['startDate']) {
        res.time = [time['startDate'].stringValue, time['endDate'].stringValue];
      }
    } else {
      res.time = [time.stringValue];
    }
    return res;
  },

  /**
   * TODO:
   * @param {String} msg: Actual raw input from the user which will be sent to DialogFlow for processing
   * @return {Object} returns an object containing the type of an action (e.g. meeting, constraint, etc.)
   * which will be sent back to front-end as response.
   */
  async sendQuery(msg) {
    // Session id
    const sessionId = uuid.v4();

    // Create a new session client
    const sessionClient = new dialogflow.SessionsClient({credentials: {
      client_email: mainCreds.client_email,
      private_key: mainCreds.private_key,
    }});

    // Generate new session
    const session = sessionClient.projectAgentSessionPath(mainCreds.project_id, sessionId);

    // Query msg
    const responses = await sessionClient.detectIntent({
      session,
      queryInput: {
        text: {
          text: msg,
          languageCode: 'en',
        },
      },
    });

    let res = {};

    // Checking if the response is invalid e.g null etc
    if (responses && responses.length && responses[0]) {
      const queryRes = responses[0].queryResult;
      res.type = queryRes.action;
      // Determine which action this is and call the relevant action handler
      if (res.type == 'unknown') {
        res.msg = queryRes.fulfillmentText;
      } else {
        const handler = context._actionHandlers[queryRes.action];
        if (handler) res = {...res, ...handler(queryRes.parameters.fields)};
      }
    } else {
      res.error = 'No response found';
    }
    console.log('DIALOGFLOW:', res);
    return res;
  },

  /**
   * TODO:
   * @param {String} title: Actual raw input from the user which will be sent to DialogFlow for processing
   * @return {int} returns an integer to indicate the category
   *               (social = 0, work = 1, breakfast = 2, lunch = 3, dinner = 4, unknown = 1 (assume work)).
   */
  async getCategory(title) {
    // Session id
    const sessionId = uuid.v4();

    // Create a new session client
    const sessionClient = new dialogflow.SessionsClient({credentials: {
      client_email: semanticCreds.client_email,
      private_key: semanticCreds.private_key,
    }});

    // Generate new session
    const session = sessionClient.projectAgentSessionPath(semanticCreds.project_id, sessionId);

    // Query msg
    const responses = await sessionClient.detectIntent({
      session,
      queryInput: {
        text: {
          text: title,
          languageCode: 'en',
        },
      },
    });

    // Checking if the reponses is invalid e.g null etc
    if (responses && responses.length && responses[0]) {
      const queryRes = responses[0].queryResult;
      if (!queryRes) return 1;
      return ['social', 'work', 'breakfast', 'lunch', 'dinner']
          .includes(queryRes.action) ? queryRes.action === 'work' ? 1 : 0 : 1;
      // return ['social', 'work', 'breakfast', 'lunch', 'dinner'].indexOf(queryRes.action);
    } else {
      console.log('No response found');
      return 1;
    }
  },

  /**
   * Given a specific date, a date range, neither, or both, returns a start and end range for the scheduler
   * to process later.
   * @param {Object} specificDate
   * @param {Object} dateRange
   * @return {Object} with properties start and end
   * @private
   */
  _parseDateRange(specificDate, dateRange) {
    const TODAY = DateTime.local();
    const newDateRange = {start: TODAY.toISO(), end: TODAY.plus({months: 1}).toISO()};

    if (specificDate.stringValue !== '') {
      newDateRange.start = DateTime.fromISO(specificDate.stringValue).startOf('day').toISO();
      newDateRange.end = DateTime.fromISO(specificDate.stringValue).endOf('day').toISO();
      return newDateRange;
    }

    if (dateRange.structValue) {
      const time = dateRange.structValue.fields;
      if (time['endDate'] && time['startDate']) {
        newDateRange.start = time['startDate'].stringValue;
        newDateRange.end = time['endDate'].stringValue;
      }
    }

    return newDateRange;
  },

  _parseTimeRange(specificTime, timeRange) {
    const CURR_DATE_TIME = DateTime.local();
    const newTimeRange = {start: CURR_DATE_TIME.startOf('day').toISO(),
      end: CURR_DATE_TIME.endOf('day').toISO()};

    if (specificTime.stringValue !== '') {
      newTimeRange.start = specificTime.stringValue;
      newTimeRange.end = specificTime.stringValue;
      return newTimeRange;
    }

    if (timeRange.structValue) {
      const time = timeRange.structValue.fields;
      if (time['endTime'] && time['startTime']) {
        newTimeRange.start = time['startTime'].stringValue;
        newTimeRange.end = time['endTime'].stringValue;
      }
    }

    return newTimeRange;
  },
};

module.exports = context;
