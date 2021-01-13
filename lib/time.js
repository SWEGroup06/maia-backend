const { DateTime } = require("luxon");

const MONDAY = 0;
const FRIDAY = 4;
const SATURDAY = 5;
const SUNDAY = 6;

module.exports = {
  /**
   * Returns a 2D matrix representing the days in which someone is available
   * to work.
   *
   * @param {Array} days - array of objects given in the following format:
   * {stringValue: 'Monday', kind: 'StringValue'}
   * @return {Array} arrays of 0s and 1s representing the busy days
   * (where array[0] represents Monday)
   */
  getBusyDays: function (days) {
    const busyDays = Array(7).fill(0);

    for (const day of days) {
      switch (day.stringValue) {
        case "Monday":
          busyDays[0] = 1;
          break;
        case "Tuesday":
          busyDays[1] = 1;
          break;
        case "Wednesday":
          busyDays[2] = 1;
          break;
        case "Thursday":
          busyDays[3] = 1;
          break;
        case "Friday":
          busyDays[4] = 1;
          break;
        case "Saturday":
          busyDays[5] = 1;
          break;
        case "Sunday":
          busyDays[6] = 1;
          break;
        case "Everyday":
          busyDays.fill(1);
          break;
        case "Weekend":
          busyDays[5] = 1;
          busyDays[6] = 1;
          break;
        case "Weekdays":
          for (let i = 0; i < 5; i++) {
            busyDays[i] = 1;
          }
          break;
      }
    }

    return busyDays;
  },

  /**
   * Given an array of time objects, parses them to return an array of
   * 'busy times' with start and end times
   *
   * @param {Array} times - format: {startTime: ISO String, endTime: ISO String}
   * @return {Array} in format: [{startTime: ISO String, endTime: ISO String}]
   */
  getBusyTimes: function (times) {
    const busyTimes = [];
    for (const time of times) {
      const busyTime = {};
      busyTime.startTime = time.structValue.fields.startTime.stringValue;
      busyTime.endTime = time.structValue.fields.endTime.stringValue;
      busyTimes.push(busyTime);
    }
    return busyTimes;
  },

  /**
   * Returns a generic date (01/01/1970) with the the time of the DateTime
   * string passed in.
   *
   * @param {string} dateTimeISO - time to extract and normalise.
   * @return {string} - normalised ISO String
   */
  normaliseDate(dateTimeISO) {
    const date = new Date(dateTimeISO.split("+")[0]);
    return new Date(
      `1 Jan 1970 ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}+00:00`
    ).toISOString();
  },

  /**
   * If the user specifies the event to be 'before' or 'after' a specific range,
   * we must change the start and end time of the range.
   *
   * @param {string} beforeAfterKey - either "before" or "after"
   * @param {DateTime} startDateTimeOfRange - start of range
   * @param {DateTime} endDateTimeOfRange - end of range
   * @return {{startDateTimeOfRange: DateTime, endDateTimeOfRange: (DateTime)}}
   * the new start and end time to consider.
   */
  parseBeforeAfter(beforeAfterKey, startDateTimeOfRange, endDateTimeOfRange) {
    if (beforeAfterKey === "before") {
      endDateTimeOfRange = startDateTimeOfRange;
      // TODO: try to round to nearest half hour
      startDateTimeOfRange = DateTime.local().plus({ hours: 1 });
    } else if (beforeAfterKey === "after") {
      startDateTimeOfRange = endDateTimeOfRange;
      endDateTimeOfRange = startDateTimeOfRange.plus({ days: 14 });
    }

    return { endDateTimeOfRange, startDateTimeOfRange };
  },

  /**
   * Combines the date of the first parameter with the time of the second
   * parameter.
   *
   * @param {string} dateISO - date to consider
   * @param {string} timeISO - time to consider
   * @return {string} ISO String of both date and time combined
   */
  combineDateAndTime(dateISO, timeISO) {
    const date = DateTime.fromISO(dateISO);
    const time = DateTime.fromISO(timeISO);
    return DateTime.local(
      date.year,
      date.month,
      date.day,
      time.hour,
      time.minute
    ).toISO();
  },

  /**
   * Generates a time range taking into account the duration of the Google
   * event which is passed in. This function may be extended for other
   * calendars.
   *
   * @param {object} oldEvent - previous event in Google Calendar format.
   * @param {string} newStartTimeRangeISO - start of time range.
   * @param {string} newEndTimeRangeISO - end of time range.
   * @return {object} - start and end range given the duration of the event.
   */
  generateTimeRangeFromGoogleEvent(
    oldEvent,
    newStartTimeRangeISO,
    newEndTimeRangeISO
  ) {
    const oldEventStart = DateTime.fromISO(oldEvent.start.dateTime);
    const oldEventEnd = DateTime.fromISO(oldEvent.end.dateTime);
    const duration = oldEventEnd.diff(oldEventStart, "minutes");

    const start = DateTime.fromISO(newEndTimeRangeISO);
    const end = start.plus(duration);

    return { start: start.toISO(), end: end.toISO() };
  },

  /**
   * Generates a 2D array concerning the possible time ranges of each weekday.
   *
   * @param {string} dayOfWeek e.g. 'Monday', 'Tuesday', etc.
   * @param {string} startTimeRangeISO - the start of the time range
   * @param {string} endTimeRangeISO - the end of the time range
   * @return {Array} - returns an array of length 7 representing the seven
   * days of the week, starting from Monday (index 0)
   */
  generateTimeRangesForDaysOfWeek(
    dayOfWeek,
    startTimeRangeISO,
    endTimeRangeISO
  ) {
    // 2D Array of fixed size 7 to represent each day of the week, starting from Monday (index 0)
    const busyDays = Array(7).fill([]);
    const dayIndex = this.getDayOfWeek(dayOfWeek);

    if (dayIndex !== -1) {
      busyDays[dayIndex] = [
        { startTime: startTimeRangeISO, endTime: endTimeRangeISO },
      ];
      return busyDays;
    }

    if (dayOfWeek === "Weekend") {
      for (let day = SATURDAY; day <= SUNDAY; day++) {
        busyDays[day] = [
          { startTime: startTimeRangeISO, endTime: endTimeRangeISO },
        ];
      }
      return busyDays;
    }

    if (dayOfWeek === "Weekdays") {
      for (let day = MONDAY; day <= FRIDAY; day++) {
        busyDays[day] = [
          { startTime: startTimeRangeISO, endTime: endTimeRangeISO },
        ];
      }
      return busyDays;
    }

    // If it is none of these specific days, or range of days, we assume it is every day.
    for (let day = MONDAY; day <= SUNDAY; day++) {
      busyDays[day] = [
        { startTime: startTimeRangeISO, endTime: endTimeRangeISO },
      ];
    }

    return busyDays;
  },

  /**
   * Ignores the time zone passed in and attaches the local time zone onto
   * the ISO String. This function is used due to an issue with DialogFlow ES's
   * time zone compatibility.
   *
   * @param {string} dateTimeISO with a possibly incorrect time zone.
   * @return {string} dateTimeISO adjusted to timezone +00:00
   */
  maintainLocalTimeZone(dateTimeISO) {
    if (dateTimeISO) {
      const dateTime = DateTime.fromISO(dateTimeISO.slice(0, -6));
      dateTime.setZone("Europe/Paris", { keepLocalTime: true });
      return dateTime.toISO();
    }
    return null;
  },

  /**
   *
   * @param {string} timeISO - time to round
   * @return {string} - rounded time
   */
  roundTimeToSameDay(timeISO) {
    let time = DateTime.fromISO(timeISO);
    const diffStart = time.diff(time.startOf("minute"));
    const roundedStart = time.plus(diffStart).startOf("minute");
    if (roundedStart.day === time.day) {
      time = roundedStart;
    }
    return time.toISO();
  },

  /**
   * Simple function to check if two times are the same to the minute, ignoring
   * seconds and time zones.
   *
   * @param {string} time1 - first time to compare
   * @param {string} time2 - second time to compare
   * @return {boolean} - whether the two times are the same
   */
  compareDateTime(time1, time2) {
    return time1.substring(0, 17) === time2.substring(0, 17);
  },

  /**
   * Returns the day of the week given an index.
   *
   * @param {number} dayNumber - index representing a day.
   * @return {string} - day of the week as a string
   */
  getDayOfWeekFromInt: function (dayNumber) {
    switch (dayNumber) {
      case 1:
        return "Mon";
      case 2:
        return "Tue";
      case 3:
        return "Wed";
      case 4:
        return "Thu";
      case 5:
        return "Fri";
      case 6:
        return "Sat";
      case 7:
        return "Sun";
      default:
        return "UNKNOWN";
    }
  },

  /**
   * Simple function to return a number corresponding to a set day of the week.
   *
   * @param {string} dayOfWeek e.g. 'Monday', 'mon', 'Tuesday'
   * @return {number} representing the day of the week
   */
  getDayOfWeek: function (dayOfWeek) {
    if (!dayOfWeek) {
      return -1;
    } else {
      dayOfWeek = dayOfWeek.toLowerCase();
    }
    const indices = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
      .map((val, i) => (dayOfWeek.includes(val) ? i : null))
      .filter((val) => val != null);
    return indices && indices.length ? indices[0] : -1;
  },

  /**
   * Checks that the date time passed in is between the start and end range.
   *
   * @param {string} dateTimeISO - date and time to check if between range
   * @param {DateTime} startRange - beginning of range to check between
   * @param {DateTime} endRange - end of range to check between
   * @return {boolean} - whether dateTimeISO is between startRange and endRange
   */
  isBetweenTimes(dateTimeISO, startRange, endRange) {
    const dateTime = DateTime.fromISO(dateTimeISO);
    return startRange <= dateTime && dateTime <= endRange;
  },

  /**
   * From two ISO strings, calculates their duration and returns it in minutes.
   *
   * @param {string} startISO - start time (before end time)
   * @param {string} endISO - end time (after start time)
   * @return {number} - duration in minutes
   */
  getDurationInMinutes(startISO, endISO) {
    const start = DateTime.fromISO(startISO);
    const end = DateTime.fromISO(endISO);
    const difference = end.diff(start, "minutes");
    return difference.minutes;
  },
};
