const {Duration, DateTime} = require('luxon');

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
      case 0:
        return 'Mon';
      case 1:
        return 'Tue';
      case 2:
        return 'Wed';
      case 3:
        return 'Thu';
      case 4:
        return 'Fri';
      case 5:
        return 'Sat';
      case 6:
        return 'Sun';
      default:
        return 'UNKNOWN';
    }
  },

  /**
   * TODO: Comment
   *
   * @param {String} day
   * @return {Number}
   */
  getDayOfWeek: function(day) {
    const indicies = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((val, i) => day.includes(val) ? i : null).filter((val) => val != null);
    return indicies && indicies.length ? indicies[0] : -1;
  },

  /**
   * TODO: Ali + Sam
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
   * TODO: Ali + Sam
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
   * TODO: Comment, returns if times are the same
   * @param {String} time1
   * @param {String} time2
   * @return {boolean}
   */
  compareTime(time1, time2) {
    return (DateTime.fromISO(time1).setZone('utc').diff(DateTime.fromISO(time2).setZone('utc'))).values.milliseconds < 60000;
  },
};
