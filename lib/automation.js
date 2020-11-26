const {DateTime, Duration} = require('luxon');
const SCHEDULER = require('../src/scheduler');

const DIALOGFLOW = require('../lib/dialogflow');
const DATABASE = require('./database.js');
const GOOGLE = require('./google.js');

const EMAIL = require('./email.js');

const THRESHOLD = 3.6e6; // 1 hour threshold

const histFreqLifetime = Duration.fromObject({days: 5});

/**
 * ...
 * @param {Array} events
 * @return {[]}
 */
function getDescriptions(events) {
  if (!events || events.length === 0) {
    console.log('No event found in time frame');
    return;
  }
  const eventsWithDescription = [];
  // could possible have the same summary multiple times
  events.forEach((element) => {
    try {
      const description = JSON.parse(element.description);
      if (description.flexible !== null &&
          description.category !== null &&
          description.startDateRange &&
          description.endDateRange) {
        eventsWithDescription.push({
          title: element.summary,
          startDate: element.start.dateTime,
          endDate: element.end.dateTime,
          flexible: description.flexible,
          category: description.category,
          startDateRange: description.startDateRange,
          endDateRange: description.endDateRange,
        });
        console.log('yes');
      }
    } catch (err) {
      console.log('no');
    }
  });

  // console.log(eventsWithDescription);

  return eventsWithDescription;
}

module.exports = {
  start: async function(INTERVAL) {
    const update = async function() {
      console.log('START OF CHECK');

      const today = DateTime.local().plus(Duration.fromObject({days: 2}));
      const nextWeek = today.plus(Duration.fromObject({days: 11}));
      console.log('today', today.toISO(), 'tomorrow', nextWeek.toISO());

      // const today = new Date();
      // const nextWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate()+17);

      const allUserData = await DATABASE.getAllUserData();

      for (const user of allUserData) {
        console.log('EMAIL', user.google.email);

        if (user.google.email != 'siennahunter1@gmail.com') continue;

        const token = JSON.parse(user.google.token);

        // Get and generate user constraints
        const constraints = await SCHEDULER.generateConstraints(user.constraints, today.toISO(), nextWeek.toISO());

        // Retrieve all meetings
        const meetings = await GOOGLE.getMeetings(token, today.toISO(), nextWeek.toISO());
        // Get History from one month ago
        const _today = DateTime.local();
        const oneMonthAgo = _today.minus(Duration.fromObject({days: 30}));

        // Get History Frequencies
        const histFreqsPerCat = [];
        for (let i = 0; i < user.frequencies.length; i++) {
          const histFreqInfo = user.frequencies[i];
          let histFreq = histFreqInfo.histFreq;

          if (histFreqInfo.timestamp == null || _today.diff(DateTime.fromISO(histFreqInfo.timestamp), ['minutes']) > histFreqLifetime) {
            console.log('OUT OF DATE!! UPDATING');
            // if out of date, recalculate hist freq and update in db
            const lastMonthHist = await GOOGLE.getMeetings(token, oneMonthAgo.toISO(), _today.toISO());
            histFreq = await SCHEDULER.getUserHistory(lastMonthHist.map((e) => [e.start.dateTime, e.end.dateTime, e.summary]), i-1);
            await DATABASE.setFrequenciesByCategory(user.email, i-1, histFreq);
          }
          histFreqsPerCat.push(histFreq);
        }
        // Get busy times to calculate free times
        const busyTimes = await GOOGLE.getBusySchedule(token, today.toISO(), nextWeek.toISO());
        const freeTimes = SCHEDULER.getFreeSlots(busyTimes.map((slot) => [slot.start, slot.end]), today.toISO(), nextWeek.toISO());

        const suggestions = [];
        const maiaManagedEvents = getDescriptions(meetings);
        console.log(maiaManagedEvents);
        for (const event of maiaManagedEvents) {
          // TODO: add organiser to maia managed info section
          // console.log(event.organizer.email, user.google.email, event.summary);
          // Disregard meetings where the user isn't the organiser
          // if (event.organizer.email != user.google.email) break;

          const duration = DateTime.fromISO(event.endDate).diff(DateTime.fromISO(event.startDate));

          // Determine new meeting slot and calculate time difference between original slot
          const category = event.category;
          const chosenSlot = SCHEDULER.findMeetingSlot([freeTimes], duration, [constraints], [histFreqsPerCat[category + 1]]);
          if (!chosenSlot) continue;

          const changeDifference = DateTime.fromISO(chosenSlot.start).diff(DateTime.fromISO(event.startDate));

          // Only suggest meeting if the difference is greater than difference threshold
          if (Math.abs(changeDifference.milliseconds) > THRESHOLD) {
            suggestions.push({
              name: event.title,
              from: {start: event.startDateRange, end: event.endDateRange},
              to: chosenSlot,
            });
          }
        }
        console.log('\n\n*****suggestions****\n', suggestions);
        EMAIL.sendRescheduleEmail(user.google.email, suggestions);
        break;
      }

      console.log('END OF CHECK');
    };
    await update();
    // setInterval(update, INTERVAL);
  },
};
