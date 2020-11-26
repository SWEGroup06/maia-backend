const {DateTime, Duration} = require('luxon');
const SCHEDULER = require('../src/scheduler');

const DIALOGFLOW = require('../lib/dialogflow');
const DATABASE = require('./database.js');
const GOOGLE = require('./google.js');

const EMAIL = require('./email.js');

const THRESHOLD = 3.6e6; // 1 hour threshold

const histFreqLifetime = Duration.fromObject({days: 5});

module.exports = {
  start: async function(INTERVAL) {
    const update = async function() {
      console.log('START OF CHECK');

      const today = new Date();
      const nextWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate()+7);

      const allUserData = await DATABASE.getAllUserData();

      for (const user of allUserData) {
        console.log('EMAIL', user.google.email);

        if (user.google.email != 'kpal81xd@gmail.com') continue;

        const token = JSON.parse(user.google.token);

        // Get and generate user constraints
        const constraints = await SCHEDULER.generateConstraints(user.constraints, today.toISOString(), nextWeek.toISOString());

        // Retrieve all meetings
        const meetings = await GOOGLE.getMeetings(token, today.toISOString(), nextWeek.toISOString());

        // Get History from one month ago
        const _today = DateTime.local();
        const oneMonthAgo = _today.minus(Duration.fromObject({days: 30}));

        // Get History Frequencies
        const histFreqsPerCat = [];
        for (let i = 0; i < user.frequencies.length; i++) {
          const histFreqInfo = user.frequencies[i];
          let histFreq = histFreqInfo.histFreq;
          if (!histFreq || !histFreqInfo.timestamp || histFreqInfo.timestamp.minus(_today) > histFreqLifetime) {
            // if out of date, recalculate hist freq and update in db
            const lastMonthHist = await GOOGLE.getMeetings(token, oneMonthAgo.toISO(), _today.toISO());
            histFreq = await SCHEDULER.getUserHistory(lastMonthHist.map((e) => [e.start.dateTime, e.end.dateTime, e.summary]), i - 1);
          }
          histFreqsPerCat.push(histFreq);
        }

        // Get busy times to calculate free times
        const busyTimes = await GOOGLE.getBusySchedule(token, today.toISOString(), nextWeek.toISOString());
        const freeTimes = SCHEDULER.getFreeSlots(busyTimes.map((slot) => [slot.start, slot.end]), today.toISOString(), nextWeek.toISOString());

        const suggestions = [];
        for (const meeting of meetings) {
          // Disregard meetings where the user isnt the organiser
          if (meeting.organizer.email != user.google.email) break;

          // Calculate slot duration
          const duration = DateTime.fromISO(meeting.end.dateTime).diff(DateTime.fromISO(meeting.start.dateTime));

          // Determine new meeting slot and calculate time difference between original slot
          const category = await DIALOGFLOW.getCategory(meeting.summary);
          const chosenSlot = SCHEDULER.findMeetingSlot([freeTimes], duration, [constraints], histFreqsPerCat[category + 1]);
          if (!chosenSlot) continue;

          const changeDifference = DateTime.fromISO(chosenSlot.start).diff(DateTime.fromISO(meeting.start.dateTime));

          // Only suggest meeting if the difference is greater than difference threshold
          if (Math.abs(changeDifference.milliseconds) > THRESHOLD) {
            suggestions.push({
              name: meeting.summary,
              from: {start: meeting.start.dateTime, end: meeting.end.dateTime},
              to: chosenSlot,
            });
          }
        }
        EMAIL.sendRescheduleEmail(user.google.email, suggestions);
        break;
      }

      console.log('END OF CHECK');
    };
    await update();
    // setInterval(update, INTERVAL);
  },
};
