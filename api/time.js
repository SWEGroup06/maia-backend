module.exports = {
  /**
   * Takes in date as ISO String, returns time in 00:00 format as a String
   * @param {String} isoDate
   * @return {*}
   */
  getTimeFromISO: function(isoDate) {
    const result = isoDate.match(/\d\d:\d\d/);
    return result[0];
  },

  /**
   * Takes in time in 00:00 format as a String, returns in ISO String format with date 01/01/1970
   * @param {String} time
   * @return {string}
   */
  getISOFromTime: function(time) {
    const hourMin = time.split(':');
    const hour = parseInt(hourMin[0]);
    const min = parseInt(hourMin[1]);
    const d = new Date(1970, 1, 1, hour, min);
    return d.toISOString();
  },
};
