const {DateTime} = require('luxon');

const SCHEDULER = require('../src/scheduler');

const DATABASE = require('./database.js');
const GOOGLE = require('./google.js');

const THRESHOLD = 3.6e6; // 1 hour threshold

module.exports = {
  start: async function(INTERVAL) {
    const update = async function() {
      const today = new Date();
      const nextWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate()+7);

      const allUserData = await DATABASE.getAllUserData();
      for (const user of allUserData) {
        console.log('EMAIL', user.google.email);

        const token = JSON.parse(user.google.token);

        // Get and generate user constraints
        const constraints = await SCHEDULER.generateConstraints(user.constraints, today.toISOString(), nextWeek.toISOString());

        // Retrieve all meetings
        const meetings = await GOOGLE.getMeetings(token, today.toISOString(), nextWeek.toISOString());

        // Get busy times to calculate free times
        const busyTimes = await GOOGLE.getBusySchedule(token, today.toISOString(), nextWeek.toISOString());
        const freeTimes = SCHEDULER.getFreeSlots(busyTimes.map((slot) => [slot.start, slot.end]), today.toISOString(), nextWeek.toISOString());

        for (const meeting of meetings) {
          // Disregard meetings where the user isnt the organiser
          if (meeting.organizer.email != user.google.email) return;

          // Calculate slot duration
          const duration = DateTime.fromISO(meeting.end.dateTime).diff(DateTime.fromISO(meeting.start.dateTime));

          // Determine new meeting slot and calculate time difference between original slot
          const chosenSlot = SCHEDULER.findMeetingSlot([freeTimes], duration, [constraints]);
          const changeDifference = DateTime.fromISO(chosenSlot.start).diff(DateTime.fromISO(meeting.start.dateTime));

          // Only suggest meeting if the difference is greater than difference threshold
          if (Math.abs(changeDifference.milliseconds) <= THRESHOLD) {
            console.log('DIFFERENCE TOO SMALL');
          } else {
            console.log('MEETING SUGGESTION', {from: {start: meeting.start.dateTime, end: meeting.end.dateTime}, to: chosenSlot});

            // Send suggestion to user
          }
        }
      }
    };
    await update();
    setInterval(update, INTERVAL);
  },
};
