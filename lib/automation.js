const { DateTime, Duration } = require("luxon");

const DATABASE = require("./database.js");
const MEETINGS = require("./meetings.js");
const GOOGLE = require("./google.js");
const EMAIL = require("./email.js");

const THRESHOLD = 3.6e6 * 24; // 24 hour threshold

const TODAY = DateTime.local();
const NEXT_WEEK = TODAY.plus({ days: 7 });

module.exports = {
  start: async function (INTERVAL) {
    const update = async function () {
      const allUserData = await DATABASE.getAllUserData();

      for (const user of allUserData) {
        const googleEmail = user.google.email;
        if (googleEmail != "s.amnabidi@gmail.com") continue;

        const token = JSON.parse(user.google.token);

        // Retrieve all meetings
        const meetings = await GOOGLE.getMeetings(
          token,
          TODAY.toISO(),
          NEXT_WEEK.toISO()
        );

        const suggestions = [];

        for (const meeting of meetings) {
          if (!meeting.description || !meeting.description.length) {
            continue;
          }

          const info = JSON.parse(meeting.description);

          const chosenSlot = await MEETINGS.reschedule(
            googleEmail,
            meeting.summary,
            meeting.start.dateTime,
            TODAY.toISO(),
            NEXT_WEEK.endOf("day").toISO(),
            TODAY.startOf("day").toISO(),
            TODAY.endOf("day").toISO(),
            "",
            true,
            false,
            info.flexible,
            false
          );

          console.log(chosenSlot);

          if (!chosenSlot) {
            continue;
          }

          const difference = DateTime.fromISO(chosenSlot.start).diff(
            DateTime.fromISO(meeting.start.dateTime)
          );

          // Only suggest meeting if the difference is greater than difference threshold
          if (Math.abs(difference.milliseconds) > THRESHOLD) {
            suggestions.push({
              name: meeting.summary,
              from: {
                start: meeting.start.dateTime,
                end: meeting.end.dateTime,
              },
              to: {
                start: chosenSlot.start,
                end: chosenSlot.end,
              },
            });
            // TODO: Change back to > 2
            if (suggestions.length > 3) {
              break;
            }
          }
        }
        EMAIL.sendRescheduleEmail(googleEmail, suggestions);
        break;
      }

      console.log("END OF CHECK");
    };
    await update();
    // setInterval(update, INTERVAL);
  },
};
