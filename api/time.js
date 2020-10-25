module.exports = {
  getTimeFromISO: function(isoDate) {
    const result = isoDate.match(/\d\d:\d\d/);
    return result[0];
  },
};
