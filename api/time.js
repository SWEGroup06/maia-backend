module.exports = {
  /**
   * Takes in time in 00:00 format as a String, returns in ISO String format with date 01/01/1970
   * @param {String} time
   * @return {string}
   */
  parseTime: function(time) {
    // TODO: add edge case checks
    const dte = new Date();
    const parsedTime = time.match( /(\d+)(?::(\d\d))?\s*(p?)/ );
    dte.setHours( parseInt( parsedTime[1]) + (parsedTime[3] ? 12 : 0) );
    dte.setMinutes( parseInt( parsedTime[2]) || 0 );
    return dte;
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
    const dayToCheck = day.toLowerCase();
    if (dayToCheck.includes('mon')) {
      return 0;
    } else if (dayToCheck.includes('tue')) {
      return 1;
    } else if (dayToCheck.includes('wed')) {
      return 2;
    } else if (dayToCheck.includes('thu')) {
      return 3;
    } else if (dayToCheck.includes('fri')) {
      return 4;
    } else if (dayToCheck.includes('sat')) {
      return 5;
    } else if (dayToCheck.includes('sun')) {
      return 6;
    } else {
      return -1;
    }
  },


};
