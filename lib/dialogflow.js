const dialogflow = require("@google-cloud/dialogflow");
const uuid = require("uuid");
const TIME = require("./time.js");
const { DateTime } = require("luxon");

const mainCreds = JSON.parse(process.env.MAIN_CREDS);
const semanticCreds = JSON.parse(process.env.SEMANTIC_CREDS);

const context = {
  _actionHandlers: {
    /**
     * Parses the information from DialogFlow into key attributes which are
     * used to schedule the event.
     *
     * @param {object} fields - object returned from DialogFlow to be parsed
     * @return {object} returns an object of the parsed DialogFlow command.
     */
    schedule: function (fields) {
      const dateProperties = context._parseDateRange(
        fields["specific-date"],
        fields["date-range"]
      );
      const timeProperties = context._parseTimeRange(
        fields["specific-time"],
        fields["time-range"]
      );

      return {
        title: fields["title"].stringValue,
        duration: context.parseDuration(fields["duration"].structValue),
        people: fields["slack-attendees"].listValue.values.map(
          (e) => e.stringValue
        ),

        startDateRange: dateProperties.dateRange.start,
        endDateRange: dateProperties.dateRange.end,

        startTimeRange: timeProperties.timeRange.start,
        endTimeRange: timeProperties.timeRange.end,
        timeRangeSpecified: timeProperties.timeRangeSpecified,
        flexible: timeProperties.flexible || dateProperties.flexible,

        dayOfWeek: fields["day-of-week"].stringValue,
      };
    },

    /**
     * Parses the information from DialogFlow into key attributes which are
     * used to reschedule an existing event.
     *
     * @param {object} fields - object returned from DialogFlow to be parsed
     * @return {object} returns an object of the parsed DialogFlow command.
     */
    reschedule: function (fields) {
      const dateProperties = context._parseDateRange(
        fields["new-specific-date"],
        fields["new-date-range"]
      );
      const timeProperties = context._parseTimeRange(
        fields["new-specific-time"],
        fields["new-time-range"]
      );

      return {
        // Title and/or date time specifying the event to reschedule
        oldTitle: fields["old-title"].stringValue,
        oldDateTime: TIME.combineDateAndTime(
          fields["old-date"].stringValue,
          TIME.maintainLocalTimeZone(fields["old-time"].stringValue)
        ),

        // Date range to reschedule to
        newStartDateRange: dateProperties.dateRange.start,
        newEndDateRange: dateProperties.dateRange.end,

        // Time range to reschedule to
        newStartTimeRange: timeProperties.timeRange.start,
        newEndTimeRange: timeProperties.timeRange.end,

        // Whether the user has specified for particular day(s) of the week
        newDayOfWeek: fields["new-day-of-week"].stringValue,

        // Flags of whether user has specified range
        flexible: timeProperties.flexible || dateProperties.flexible,
        dateRangeSpecified: dateProperties.dateRangeSpecified,
        timeRangeSpecified: timeProperties.timeRangeSpecified,
      };
    },

    /**
     * Parses the information from DialogFlow into key attributes which are
     * used to set working hours for particular days in the week for a user.
     *
     * @param {object} fields - object returned from DialogFlow to be parsed
     * @return {object} returns an object of the parsed DialogFlow command.
     */
    constraint: function (fields) {
      return {
        busyDays: TIME.getBusyDays(fields.dayOfWeek.listValue.values),
        busyTimes: TIME.getBusyTimes(fields["time-period"].listValue.values),
      };
    },

    /**
     * Parses the information from DialogFlow into key attributes which are
     * used to cancel an existing event.
     *
     * @param {object} fields - object returned from DialogFlow to be parsed
     * @return {object} returns an object of the parsed DialogFlow command.
     */
    cancel: function (fields) {
      return {
        meetingTitle: fields.meetingName.stringValue,
        meetingDateTime: TIME.combineDateAndTime(
          fields.date.stringValue,
          fields.time.stringValue
        ),
      };
    },

    setMinBreak: function (fields) {
      return {
        minBreakLength: context.parseDuration(fields["duration"].structValue),
      };
    },
  },

  /**
   * If user specifies a duration for the meeting, return the duration in
   * minutes. If not, return null.
   *
   * @param {object} meeting - Object specifying unit and duration of meeting.
   * @return {null|number} returns the duration of the meeting in minutes.
   */
  parseDuration(meeting) {
    if (meeting && "fields" in meeting) {
      const unit = meeting.fields.unit.stringValue;
      const duration = meeting.fields.amount.numberValue;

      if (unit === "min") {
        // User stated duration in minutes
        return duration;
      }

      if (unit === "h") {
        // User stated duration in hours
        return duration * 60;
      }

      if (unit === "d") {
        // User stated duration in days
        return duration * 24 * 60;
      }
    }

    return null;
  },

  /**
   * Sends query to DialogFlow for processing.
   *
   * @param {string} msg - Actual raw input from the user which will be sent to
   * DialogFlow for processing.
   * @return {object} returns an object containing the type of an action
   * (e.g. meeting, constraint, etc.)
   * which will be sent back to front-end as response.
   */
  async sendQuery(msg) {
    // Session id
    const sessionId = uuid.v4();

    // Create a new session client
    const sessionClient = new dialogflow.SessionsClient({
      credentials: {
        client_email: mainCreds.client_email,
        private_key: mainCreds.private_key,
      },
    });

    // Generate new session
    const session = sessionClient.projectAgentSessionPath(
      mainCreds.project_id,
      sessionId
    );

    // Query msg
    const responses = await sessionClient.detectIntent({
      session,
      queryInput: {
        text: {
          text: msg,
          languageCode: "en",
        },
      },
    });

    let res = {};

    // Checking if the response is invalid e.g null etc
    if (responses && responses.length && responses[0]) {
      const queryRes = responses[0].queryResult;
      res.type = queryRes.action;
      // Determine which action this is and call the relevant action handler
      if (res.type == "unknown") {
        res.msg = queryRes.fulfillmentText;
      } else {
        const handler = context._actionHandlers[queryRes.action];
        if (handler) res = { ...res, ...handler(queryRes.parameters.fields) };
      }
    } else {
      res.error = "No response found";
    }
    console.log("DIALOGFLOW:", res);
    return res;
  },

  /**
   * Understand the category which the event should belong in e.g. work,
   * leisure, etc. by sending the title to DialogFlow to be processed.
   *
   * @param {string} title - Actual raw input from the user which will be sent
   * to DialogFlow for processing
   * @return {number} returns an integer to indicate the category
   * (social = 0, work = 1, breakfast = 2, lunch = 3, dinner = 4, unknown = 1).
   */
  async getCategory(title) {
    // Session id
    const sessionId = uuid.v4();

    // Create a new session client
    const sessionClient = new dialogflow.SessionsClient({
      credentials: {
        client_email: semanticCreds.client_email,
        private_key: semanticCreds.private_key,
      },
    });

    // Generate new session
    const session = sessionClient.projectAgentSessionPath(
      semanticCreds.project_id,
      sessionId
    );

    // Query msg
    const responses = await sessionClient.detectIntent({
      session,
      queryInput: {
        text: {
          text: title,
          languageCode: "en",
        },
      },
    });

    // Checking if the reponses is invalid e.g null etc
    if (responses && responses.length && responses[0]) {
      const queryRes = responses[0].queryResult;
      if (!queryRes) return 1;
      // return ["social", "work", "breakfast", "lunch", "dinner"].includes(
      //   queryRes.action
      // )
      //   ? queryRes.action === "work"
      //     ? 1
      //     : 0
      //   : -1;
      return (
        ["unknown", "social", "work", "breakfast", "lunch", "dinner"].indexOf(
          queryRes.action
        ) - 1
      );
    } else {
      console.error("getCategory: No Response Found");
      return 1;
    }
  },

  /**
   * Given a specific date, a date range, neither, or both, returns key
   * properties of the given dates: a final date range and two flags
   * (whether a date range was originally specified as well as whether the
   * event should be flexible)
   *
   * @param {object} specificDateObj - object identifying a particular date
   * @param {object} dateRangeObj - object identifying a range of dates
   * @return {object} with properties dateRange, flexible, dateRangeSpecified
   * @private
   */
  _parseDateRange(specificDateObj, dateRangeObj) {
    const dateRange = { start: null, end: null };
    let flexible = true;
    let dateRangeSpecified = true;

    if (
      !specificDateObj.stringValue &&
      !dateRangeObj.stringValue &&
      !dateRangeObj.structValue
    ) {
      dateRangeSpecified = false;
    }

    const TODAY = DateTime.local();
    dateRange.start = TODAY.plus({ hours: 2 }).toISO();
    dateRange.end = TODAY.plus({ days: 14 }).toISO();

    if (dateRangeObj.structValue) {
      const time = dateRangeObj.structValue.fields;
      if (time["endDate"] && time["startDate"]) {
        dateRange.start = time["startDate"].stringValue;
        dateRange.end = time["endDate"].stringValue;
      }
    } else if (specificDateObj.stringValue !== "") {
      flexible = false;
      dateRange.start = DateTime.fromISO(specificDateObj.stringValue)
        .startOf("day")
        .toISO();
      dateRange.end = DateTime.fromISO(specificDateObj.stringValue)
        .endOf("day")
        .toISO();
    }

    return { dateRange, flexible, dateRangeSpecified };
  },

  /**
   * Given a specific time, a time range, neither, or both, returns key
   * properties of the given dates: a final time range and two flags
   * (whether a time range was originally specified as well as whether the
   * event should be flexible)
   *
   * @param {object} specificTimeObj - object identifying a particular time
   * @param {object} timeRangeObj - object identifying a range of dates
   * @return {object} with properties timeRange, flexible, timeRangeSpecified
   * @private
   */
  _parseTimeRange(specificTimeObj, timeRangeObj) {
    const timeRange = { start: null, end: null };
    let flexible = true;

    let timeRangeSpecified = true;

    if (
      !specificTimeObj.stringValue &&
      !timeRangeObj.stringValue &&
      !timeRangeObj.structValue
    ) {
      timeRangeSpecified = false;
    }

    const TODAY = DateTime.local();
    timeRange.start = TODAY.startOf("day").toISO();
    timeRange.end = TODAY.endOf("day").toISO();

    if (specificTimeObj.stringValue !== "") {
      flexible = false;
      timeRange.start = specificTimeObj.stringValue;
      timeRange.end = specificTimeObj.stringValue;
    } else if (timeRangeObj.structValue) {
      const time = timeRangeObj.structValue.fields;
      if (time["endTime"] && time["startTime"]) {
        timeRange.start = time["startTime"].stringValue;
        timeRange.end = time["endTime"].stringValue;
      }
    }

    return { timeRange, flexible, timeRangeSpecified };
  },
};

module.exports = context;
