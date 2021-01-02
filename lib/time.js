const {DateTime} = require('luxon');

const MONDAY = 0;
const FRIDAY = 4;
const SATURDAY = 5;
const SUNDAY = 6;

module.exports = {
  /**
   * Takes in time in various formats and outputs a String representing ISO DateTime
   * @param {String} time
   * @return {String}
   */
  parseTime: function(time) {
    // TODO: add edge case checks
    const dte = new Date();
    const parsedTime = time.match( /(\d+)(?::(\d\d))?\s*(p?)/ );
    dte.setHours(parseInt( parsedTime[1]) + (parsedTime[3] ? 12 : 0));
    dte.setMinutes(parseInt(parsedTime[2]) || 0);
    return dte.toISOString();
  },

  getISOFromTime: function(time) {
    const hourMin = time.split(':');
    const hour = parseInt(hourMin[0]);
    const min = parseInt(hourMin[1]);
    const d = new Date(1970, 1, 1, hour, min);
    return d.toISOString();
  },

  /**
   * TODO: Comment
   *
   * @param {Number} dayNumber
   * @return {String}
   */
  getDayOfWeekFromInt: function(dayNumber) {
    switch (dayNumber) {
      case 1:
        return 'Mon';
      case 2:
        return 'Tue';
      case 3:
        return 'Wed';
      case 4:
        return 'Thu';
      case 5:
        return 'Fri';
      case 6:
        return 'Sat';
      case 7:
        return 'Sun';
      default:
        return 'UNKNOWN';
    }
  },

  /**
   * Return a number corresponding to a set day of the week.
   * @param {String} day
   * @return {Number}
   */
  getDayOfWeek: function(day) {
    const indices = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        .map((val, i) => (day.includes(val)) ? i : null).filter((val) => val != null);
    return (indices && indices.length) ? indices[0] : -1;
  },

  /**
   * Returns a 2D matrix representing the days in which someone is available to work.
   * @param {Array} days: array of objects {stringValue: 'Monday', kind: 'StringValue'} //TODO:
   * @return {Array} arrays of 0s and 1s representing the busy days (where array[0] represents Monday)
   */
  getBusyDays: function(days) {
    const busyDays = Array(7).fill(0);

    for (const day of days) {
      switch (day.stringValue) {
        case 'Monday':
          busyDays[0] = 1;
          break;
        case 'Tuesday':
          busyDays[1] = 1;
          break;
        case 'Wednesday':
          busyDays[2] = 1;
          break;
        case 'Thursday':
          busyDays[3] = 1;
          break;
        case 'Friday':
          busyDays[4] = 1;
          break;
        case 'Saturday':
          busyDays[5] = 1;
          break;
        case 'Sunday':
          busyDays[6] = 1;
          break;
        case 'Everyday':
          busyDays.fill(1);
          break;
        case 'Weekend':
          busyDays[5] = 1;
          busyDays[6] = 1;
          break;
        case 'Weekdays':
          for (let i = 0; i < 5; i++) {
            busyDays[i] = 1;
          }
          break;
      }
    }

    return busyDays;
  },

  /**
   * Given an array of time objects, parses them to return an array of 'busy times' with start and end times
   * @param {Array} times
   * @return {Array} an array of objects {startTime: ISO String, endTime: ISO String}
   */
  getBusyTimes: function(times) {
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
   * Checks if two times are the same to the minute, ignoring seconds.
   * @param {String} time1
   * @param {String} time2
   * @return {boolean}
   */
  compareTime(time1, time2) {
    return time1.substring(0, 17) === time2.substring(0, 17);
  },

  /**
   * Returns a generic date (01/01/1970) with the the time of the DateTime string passed in.
   * @param {String} dateStr
   * @return {string}
   */
  normaliseDate(dateStr) {
    const date = new Date(dateStr.split('+')[0]);
    return new Date(`1 Jan 1970 ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}+00:00`)
        .toISOString();
  },

  /**
   * If the user specifies the event to be 'before' or 'after' a specific range, we must change the start
   * and end time of the range.
   * @param {String} beforeAfterKey - either "before" or "after"
   * @param {DateTime} startDateTimeOfRange
   * @param {DateTime} endDateTimeOfRange
   * @return {{startDateTimeOfRange: DateTime, endDateTimeOfRange: (DateTime|Duration|*)}}
   */
  parseBeforeAfter(beforeAfterKey, startDateTimeOfRange, endDateTimeOfRange) {
    if (beforeAfterKey === 'before') {
      endDateTimeOfRange = startDateTimeOfRange;
      startDateTimeOfRange = DateTime.local().plus({hours: 1}); // TODO: try to round to nearest half hour
    } else if (beforeAfterKey === 'after') {
      startDateTimeOfRange = endDateTimeOfRange;
      endDateTimeOfRange = startDateTimeOfRange.plus({days: 14});
    }

    return {endDateTimeOfRange, startDateTimeOfRange};
  },

  /**
   * Combines the date of the first parameter with the time of the second parameter.
   * @param {String} dateISO
   * @param {String} timeISO
   * @return {String} ISO String of both date and time combined
   */
  combineDateAndTime(dateISO, timeISO) {
    const date = DateTime.fromISO(dateISO);
    const time = DateTime.fromISO(timeISO);
    return DateTime.local(date.year, date.month, date.day, time.hour, time.minute).toISO();
  },

  /**
   * TODO:
   * @param {Object} oldEvent
   * @param {String} newStartTimeRangeISO
   * @param {String} newEndTimeRangeISO
   * @return {Object}
   */
  generateTimeRangeFromGoogleEvent(oldEvent, newStartTimeRangeISO, newEndTimeRangeISO) {
    const oldEventStart = DateTime.fromISO(oldEvent.start.dateTime);
    const oldEventEnd = DateTime.fromISO(oldEvent.end.dateTime);
    const duration = oldEventEnd.diff(oldEventStart, 'minutes');

    const start = DateTime.fromISO(newEndTimeRangeISO);
    const end = start.plus(duration);

    return {start: start.toISO(), end: end.toISO()};
  },

  /**
   * TODO: Ali + Sam
   * @param {String} dayOfWeek
   * @param {String} startTimeRangeISO
   * @param {String} endTimeRangeISO
   * @return {Array}
   */
  generateTimeRangesForDaysOfWeek(dayOfWeek, startTimeRangeISO, endTimeRangeISO) {
    // 2D Array of fixed size 7 to represent each day of the week, starting from Monday (index 0)
    const busyDays = Array(7).fill([]);
    const dayIndex = this.getDayOfWeek(dayOfWeek.toLowerCase());

    console.log('generateTimeRangesForDaysOfWeek *******');
    console.log('dayOfWeek: ' + dayOfWeek);
    console.log('startTimeRangeISO: ' + startTimeRangeISO);
    console.log('endTimeRangeISO: ' + endTimeRangeISO);
    console.log('dayIndex: ' + dayIndex);

    if (dayIndex !== -1) {
      busyDays[dayIndex] = [{startTime: startTimeRangeISO, endTime: endTimeRangeISO}];
      return busyDays;
    }

    // console.log('*** busyDays after first if: ');
    // console.log(busyDays);

    if (dayOfWeek === 'Weekend') {
      for (let day = SATURDAY; day <= SUNDAY; day++) {
        busyDays[day] = [{startTime: startTimeRangeISO, endTime: endTimeRangeISO}];
      }
      return busyDays;
    }

    // console.log('*** busyDays after Weekend: ');
    // console.log(busyDays);

    if (dayOfWeek === 'Weekdays') {
      for (let day = MONDAY; day <= FRIDAY; day++) {
        busyDays[day] = [{startTime: startTimeRangeISO, endTime: endTimeRangeISO}];
      }
      return busyDays;
    }

    // console.log('*** busyDays after Weekdays: ');
    // console.log(busyDays);

    // If it is none of these specific days, or range of days, we assume it is every day.
    for (let day = MONDAY; day <= SUNDAY; day++) {
      busyDays[day] = [{startTime: startTimeRangeISO, endTime: endTimeRangeISO}];
    }

    // console.log('*** busyDays after last for loop: ');
    // console.log(busyDays);

    return busyDays;
  },

  /**
   * TODO:
   * @param {String} dateTimeISO
   * @return {String} dateTimeISO adjusted to timezone +00:00
   */
  maintainLocalTimeZone(dateTimeISO) {
    if (dateTimeISO) {
      const dateTime = DateTime.fromISO(dateTimeISO.slice(0, -6));
      dateTime.setZone('Europe/Paris', {keepLocalTime: true});
      return dateTime.toISO();
    }
    return null;
  },

  /**
   * TODO: Amelia
   *
   * @param {String} timeISO - TODO: Amelia
   * @return {string} - TODO: Amelia
   */
  roundTimeToSameDay(timeISO) {
    let time = DateTime.fromISO(timeISO);
    const diffStart = time.diff(time.startOf('minute'));
    const roundedStart = time.plus(diffStart).startOf('minute');
    if (roundedStart.day === time.day) {
      time = roundedStart;
      console.log('(rounding): ' + time.toISO());
    }
    return time.toISO();
  },
};
