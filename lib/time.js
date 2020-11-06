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
    dte.setHours( parseInt( parsedTime[1]) + (parsedTime[3] ? 12 : 0) );
    dte.setMinutes( parseInt( parsedTime[2]) || 0 );
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
   * @param {String} day
   * @return {Number}
   */
  getDayOfWeek: function(day) {
    const indicies = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((val, i) => day.includes(val) ? i : null).filter((val) => val != null);
    return indicies && indicies.length ? indicies[0] : -1;
  },
};
