const express = require("express");
// eslint-disable-next-line new-cap
const router = express.Router();

const { DateTime } = require("luxon");

const GOOGLE = require("../lib/google.js");
const DATABASE = require("../lib/database");
const MEETINGS = require("../lib/meetings.js");
const TIME = require("../lib/time.js");

// Schedule a new meeting
router.get("/schedule", async function (req, res) {
  if (!req.query.slackEmails && !req.query.googleEmails) {
    res.json({ error: "No emails" });
    return;
  }

  let title = JSON.parse(decodeURIComponent(req.query.title));
  title = title.substring(1, title.length - 1);

  const flexible = JSON.parse(decodeURIComponent(req.query.flexible));
  const duration = JSON.parse(decodeURIComponent(req.query.duration));

  let startDateTimeOfRange;
  if (!req.query.startDateTimeOfRange) {
    startDateTimeOfRange = DateTime.local();
  } else {
    startDateTimeOfRange = DateTime.fromISO(
      JSON.parse(decodeURIComponent(req.query.startDateTimeOfRange))
    );
  }

  let endDateTimeOfRange;
  if (!req.query.endDateTimeOfRange) {
    endDateTimeOfRange = startDateTimeOfRange.plus({ days: 14 });
  } else {
    endDateTimeOfRange = DateTime.fromISO(
      JSON.parse(decodeURIComponent(req.query.endDateTimeOfRange))
    );
  }

  if (req.query.beforeAfterKey) {
    const startEndTimes = TIME.parseBeforeAfter(
      JSON.parse(decodeURIComponent(req.query.beforeAfterKey)),
      startDateTimeOfRange,
      endDateTimeOfRange
    );
    startDateTimeOfRange = startEndTimes.startDateTimeOfRange;
    endDateTimeOfRange = startEndTimes.endDateTimeOfRange;
  }

  let googleEmails;
  if (req.query.googleEmails) {
    googleEmails = JSON.parse(decodeURIComponent(req.query.googleEmails));
  } else {
    const slackEmails = JSON.parse(decodeURIComponent(req.query.slackEmails));
    googleEmails = await DATABASE.getGoogleEmailsFromSlackEmails(slackEmails);
  }

  try {
    const chosenSlot = await MEETINGS.schedule(
      title,
      googleEmails,
      startDateTimeOfRange.toISO(),
      endDateTimeOfRange.toISO(),
      flexible,
      duration
    );
    res.json(chosenSlot);
  } catch (error) {
    console.error(error);
    res.send({ error: error.toString() });
  }
});

// Reschedule an existing meeting
router.get("/reschedule", async function (req, res) {
  if (!req.query.slackEmail && !req.query.googleEmail) {
    res.json({ error: "Organiser's email not found" });
    return;
  }

  if (!req.query.meetingTitle) {
    res.json({ error: "No Title Provided" });
    return;
  }

  // check if event to be reschedule has been specified
  if (!req.query.startDateTime) {
    res.json({ error: "No event start time specified for rescheduling" });
  }

  let meetingTitle = JSON.parse(decodeURIComponent(req.query.meetingTitle));
  meetingTitle = meetingTitle.substring(1, meetingTitle.length - 1);

  let startDateTimeOfRange;
  let specificTimeGiven = false;
  if (!req.query.newStartDateTime) {
    startDateTimeOfRange = DateTime.local();
  } else {
    startDateTimeOfRange = DateTime.fromISO(
      JSON.parse(decodeURIComponent(req.query.newStartDateTime))
    );
    specificTimeGiven = true;
  }

  let endDateTimeOfRange;
  if (!req.query.newEndDateTime) {
    // If no end date is specified, set a default range of two weeks from the given start range date
    endDateTimeOfRange = DateTime.local().plus({ days: 14 });
  } else {
    endDateTimeOfRange = DateTime.fromISO(
      JSON.parse(decodeURIComponent(req.query.newEndDateTime))
    );
  }

  const currEventStartTime = JSON.parse(
    decodeURIComponent(req.query.startDateTime)
  );
  let googleEmail;
  if (req.query.googleEmail) {
    googleEmail = JSON.parse(decodeURIComponent(req.query.googleEmail));
  } else {
    const slackEmail = JSON.parse(decodeURIComponent(req.query.slackEmail));
    googleEmail = await DATABASE.getGoogleEmailFromSlackEmail(slackEmail);
  }

  if (req.query.beforeAfterKey) {
    const startEndTimes = TIME.parseBeforeAfter(
      JSON.parse(decodeURIComponent(req.query.beforeAfterKey)),
      startDateTimeOfRange,
      endDateTimeOfRange
    );
    startDateTimeOfRange = startEndTimes.startDateTimeOfRange;
    endDateTimeOfRange = startEndTimes.endDateTimeOfRange;
  }

  try {
    // TODO: Delete these
    // console.log('PARAMETERS FOR MEETINGS.RESCHEDULE****');
    // console.log(meetingTitle);
    // console.log(currEventStartTime);
    // console.log(email);
    // console.log(startDateTimeOfRange.toISO());
    // console.log(endDateTimeOfRange.toISO());
    // console.log('**************************************');

    const chosenSlot = await MEETINGS.reschedule(
      currEventStartTime,
      meetingTitle,
      googleEmail,
      startDateTimeOfRange.toISO(),
      endDateTimeOfRange.toISO(),
      specificTimeGiven
    );

    res.json(chosenSlot);
  } catch (error) {
    console.error(error);
    res.send({ error: error.toString() });
  }
});

// Retrieve all meetings
router.get("/meetings", async function (req, res) {
  if (!req.query.slackEmail && !req.query.googleEmail) {
    res.json({ error: "Email not found" });
    return;
  }

  try {
    let googleEmail;
    if (req.query.googleEmail) {
      googleEmail = JSON.parse(decodeURIComponent(req.query.googleEmail));
    } else {
      const slackEmail = JSON.parse(decodeURIComponent(req.query.slackEmail));
      googleEmail = await DATABASE.getGoogleEmailFromSlackEmail(slackEmail);
    }

    // Check if a user with the provided details existing in the database
    if (!(await DATABASE.userExists(googleEmail))) {
      res.json({ error: `${googleEmail} is not signed in` });
      return;
    }

    // Get tokens from the database
    const token = JSON.parse(
      await DATABASE.getTokenFromGoogleEmail(googleEmail)
    );
    const today = new Date();
    // End date in one week for now
    const endDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 7
    );
    const events = await GOOGLE.getMeetings(
      token,
      today.toISOString(),
      endDate.toISOString()
    );

    if (!events || events.length === 0) {
      res.json({ error: "No event found in time frame" });
      return;
    }
    // could possible have the same summary multiple times
    const eventDict = [];
    events.map((event) => [event.summary, event.start.date, event.end.date]);

    res.json(eventDict);
  } catch (error) {
    console.error(error);
    res.send({ error: error.toString() });
  }
});

// Add constraints
router.get("/constraints", async function (req, res) {
  if (!req.query.slackEmail && !req.query.googleEmail) {
    res.json({ error: "Email not found" });
    return;
  }

  if (!req.query.busyTimes) {
    res.json({ error: "Busy times not found" });
  }

  if (!req.query.busyDays) {
    res.json({ error: "Busy days not found" });
    return;
  }

  try {
    let googleEmail;
    if (req.query.googleEmail) {
      googleEmail = JSON.parse(decodeURIComponent(req.query.googleEmail));
    } else {
      const slackEmail = JSON.parse(decodeURIComponent(req.query.slackEmail));
      googleEmail = await DATABASE.getGoogleEmailFromSlackEmail(slackEmail);
    }

    const days = JSON.parse(decodeURIComponent(req.query.busyDays));
    const times = JSON.parse(decodeURIComponent(req.query.busyTimes));

    await MEETINGS.setContraints(googleEmail, days, times);

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.send({ error: error.toString() });
  }
});

// Cancel event
router.get("/cancel", async function (req, res) {
  if (!req.query.slackEmail && !req.query.googleEmail) {
    res.json({ error: "Email not found" });
    return;
  }

  try {
    let googleEmail;
    if (req.query.googleEmail) {
      googleEmail = JSON.parse(decodeURIComponent(req.query.googleEmail));
    } else {
      const slackEmail = JSON.parse(decodeURIComponent(req.query.slackEmail));
      googleEmail = await DATABASE.getGoogleEmailFromSlackEmail(slackEmail);
    }
    const organiserToken = JSON.parse(
      decodeURIComponent(await DATABASE.getTokenFromGoogleEmail(googleEmail))
    );

    let meetingTitle = JSON.parse(decodeURIComponent(req.query.meetingTitle));
    meetingTitle = meetingTitle.substring(1, meetingTitle.length - 1);
    const meetingDateTime = JSON.parse(
      decodeURIComponent(req.query.meetingDateTime)
    );

    let events;

    if (meetingDateTime) {
      events = await GOOGLE.getEvents(organiserToken, meetingDateTime);
      if (
        events.length === 0 ||
        (events.length > 0 &&
          !TIME.compareTime(events[0].start.dateTime, meetingDateTime))
      ) {
        res.send({ error: "No Meeting found" });
        return;
      }
    } else if (meetingTitle && meetingTitle !== "") {
      events = await GOOGLE.getEventByName(organiserToken, meetingTitle);
    } else {
      res.send({
        error:
          "To cancel an event, please specify the event name or start time.",
      });
    }

    const eventTitle = events[0].summary;
    const eventDateTime = events[0].start.dateTime;

    await GOOGLE.cancelEvent(organiserToken, events[0].id);
    res.json({ title: eventTitle, dateTime: eventDateTime });
  } catch (error) {
    console.error(error);
    res.send({ error: error.toString() });
  }
});

router.get("/tp", async function (req, res) {
  if (!req.query.slackEmail && !req.query.googleEmail) {
    res.json({ error: "Email not found" });
    return;
  }

  console.log("\nTP REQ.QUERY************");
  console.log(req.query);
  console.log("**************************\n");

  // Check that either an event time or title has been specified.
  if (!req.query.oldDateTime && !req.query.oldTitle) {
    res.json({ error: "No event time or title specified for rescheduling." });
  }

  let googleEmail;
  if (req.query.googleEmail) {
    googleEmail = JSON.parse(decodeURIComponent(req.query.googleEmail));
  } else {
    const slackEmail = JSON.parse(decodeURIComponent(req.query.slackEmail));
    googleEmail = await DATABASE.getGoogleEmailFromSlackEmail(slackEmail);
  }

  let oldTitle = JSON.parse(decodeURIComponent(req.query.oldTitle));
  oldTitle = oldTitle.substring(1, oldTitle.length - 1);

  const oldDateTime = JSON.parse(decodeURIComponent(req.query.oldDateTime));
  const newStartDateRange = JSON.parse(
    decodeURIComponent(req.query.newStartDateRange)
  );
  const newEndDateRange = JSON.parse(
    decodeURIComponent(req.query.newEndDateRange)
  );
  const newStartTimeRange = JSON.parse(
    decodeURIComponent(req.query.newStartTimeRange)
  );
  const newEndTimeRange = JSON.parse(
    decodeURIComponent(req.query.newEndTimeRange)
  );
  const newDayOfWeek = JSON.parse(decodeURIComponent(req.query.newDayOfWeek));

  try {
    const chosenSlotToRescheduleTo = await MEETINGS.tp(
      googleEmail,
      oldTitle,
      oldDateTime,
      newStartDateRange,
      newEndDateRange,
      newStartTimeRange,
      newEndTimeRange,
      newDayOfWeek
    );
    res.json(chosenSlotToRescheduleTo);
  } catch (error) {
    console.error(error);
    res.send({ error: error.toString() });
  }
});

router.get("/preferences", async function (req, res) {
  res.sendStatus(200);
  return;
  try {
    const googleEmail = "kpal81xd@gmail.com";
    const tokens = JSON.parse(
      await DATABASE.getTokenFromGoogleEmail(googleEmail)
    );

    await MEETINGS.generatePreferences(googleEmail, tokens);

    res.send({ status: "ok" });
  } catch (err) {
    console.error(error);
    res.send({ error: error.toString() });
  }
});

module.exports = router;
