const { DateTime } = require("luxon");

const DATABASE = require("./database.js");
const MEETINGS = require("./meetings.js");
const GOOGLE = require("./google.js");
const EMAIL = require("./email.js");

const THRESHOLD = 3.6e6 * 24; // 24 hour threshold

const TODAY = DateTime.local();
const NEXT_WEEK = TODAY.plus({ days: 7 });

const context = {
  rescheduleAll: async function (googleEmail, token, write = false) {
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
        write
      );

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
        if (suggestions.length > 2) {
          break;
        }
      }
    }
    EMAIL.sendRescheduleEmail(googleEmail, suggestions);
  },
  update: async function () {
    const allUserData = await DATABASE.getAllUserData();

    for (const user of allUserData) {
      const googleEmail = user.google.email;

      const token = JSON.parse(user.google.token);

      await context.rescheduleAll(googleEmail, token);

      break;
    }

    console.log("END OF CHECK");
  },
  start: async function (INTERVAL) {
    await context.update();
    setInterval(context.update, INTERVAL);
  },
};

module.exports = context;
