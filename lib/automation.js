const { DateTime, Duration } = require("luxon");
const SCHEDULER = require("../src/scheduler");

const DATABASE = require("./database.js");
const MEETINGS = require("./meetings.js");
const GOOGLE = require("./google.js");

const THRESHOLD = 3.6e6 * 24; // 24 hour threshold

const histFreqLifetime = Duration.fromObject({ minutes: 1 });
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

module.exports = {
  start: async function (INTERVAL) {
    const update = async function () {
      const today = DateTime.local().plus(Duration.fromObject({ days: 2 }));
      const nextWeek = today.plus(Duration.fromObject({ days: 11 }));

      // const today = new Date();
      // const nextWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate()+17);

      const allUserData = await DATABASE.getAllUserData();

      for (const user of allUserData) {
        if (user.google.email != "s.amnabidi@gmail.com") continue;

        const token = JSON.parse(user.google.token);

        // Get and generate user constraints
        // TODO: Do we need this?
        // const constraints = await SCHEDULER.generateConstraints(
        //   user.constraints,
        //   today.toISO(),
        //   nextWeek.toISO()
        // );
        const workingHours = user.constraints;

        // Retrieve all meetings
        const meetings = await GOOGLE.getMeetings(
          token,
          today.toISO(),
          nextWeek.toISO()
        );
        // Get History from one month ago
        const _today = DateTime.local();
        const oneMonthAgo = _today.minus(Duration.fromObject({ days: 30 }));

        // Get History Frequencies
        const histFreqsPerCat = [];

        let lastMonthHist = await GOOGLE.getMeetings(
          token,
          oneMonthAgo.toISO(),
          _today.toISO()
        );
        lastMonthHist = lastMonthHist.map((e) => [
          e.start.dateTime,
          e.end.dateTime,
          e.summary,
        ]);
        const categorisedSchedule = await SCHEDULER.getCategorisedSchedule(
          lastMonthHist
        );
        for (let i = 0; i < user.frequencies.length; i++) {
          let histFreqInfo = user.frequencies[i];
          while (histFreqInfo.timestamp == null) {
            // wait for 30 seconds then try again
            await delay(30000);
            histFreqInfo = await DATABASE.getFrequenciesForCategoryFromGoogleEmail(
              email,
              category
            );
          }
          let histFreq = histFreqInfo.histFreq;
          if (
            _today.diff(DateTime.fromISO(histFreqInfo.timestamp), ["minutes"]) >
            histFreqLifetime
          ) {
            console.log("UPDATING HISTORY FREQUENCIES");
            // if out of date, recalculate hist freq and update in db
            histFreq = await SCHEDULER.generateUserHistory(
              categorisedSchedule,
              i
            );
            await DATABASE.setFrequenciesForCategoryFromGoogleEmail(
              user.google.email,
              i,
              histFreq
            );
          }
          histFreqsPerCat.push(histFreq);
        }

        // TODO: change minBreakLength to from input
        const minBreakLength = Duration.fromObject({ minutes: 15 });

        // Get busy times to calculate free times
        let busyTimes = await GOOGLE.getBusySchedule(
          token,
          today.toISO(),
          nextWeek.toISO()
        );
        let freeTimes = SCHEDULER.getFreeSlots(
          busyTimes.map((slot) => [slot.start, slot.end]),
          today.toISO(),
          nextWeek.toISO(),
          minBreakLength,
          workingHours
        );
        const updationsMade = [];
        const maiaManagedEvents = MEETINGS.getDescriptions(meetings);

        for (const event of maiaManagedEvents) {
          // TODO: add organiser to maia managed info section
          // Disregard meetings where the user isn't the organiser
          // if (event.organizer.email != user.google.email) break;

          const duration = DateTime.fromISO(event.endDate).diff(
            DateTime.fromISO(event.startDate)
          );

          // Determine new meeting slot and calculate time difference between original slot
          const category = event.category;
          busyTimes = await GOOGLE.getBusySchedule(
            token,
            event.startDateRange,
            event.endDateRange
          );
          freeTimes = await SCHEDULER.getFreeSlots(
            busyTimes.map((slot) => [slot.start, slot.end]),
            event.startDateRange,
            event.endDateRange,
            minBreakLength
          );

          const chosenSlot = SCHEDULER.findMeetingSlot(
            [freeTimes],
            duration,
            [histFreqsPerCat[category + 1]],
            category,
            DateTime.fromISO(event.startDate)
          );
          if (!chosenSlot) continue;

          const changeDifference = DateTime.fromISO(chosenSlot.start).diff(
            DateTime.fromISO(event.startDate)
          );

          // Only suggest meeting if the difference is greater than difference threshold
          if (Math.abs(changeDifference.milliseconds) > THRESHOLD) {
            // implement suggestions
            await GOOGLE.updateMeeting(
              token,
              {
                id: event.id,
                summary: event.title,
                description: event.description,
                attendees: event.attendees,
              },
              chosenSlot.start,
              chosenSlot.end
            );
            updationsMade.push({
              name: event.title,
              from: { start: event.startDate, end: event.endDate },
              to: chosenSlot,
            });
          }
        }

        // EMAIL.sendRescheduleEmail(user.google.email, suggestions);
        break;
      }

      console.log("END OF CHECK");
    };
    await update();
    // setInterval(update, INTERVAL);
  },
};
