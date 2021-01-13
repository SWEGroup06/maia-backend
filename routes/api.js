const express = require("express");
const router = express.Router();

const GOOGLE = require("../lib/google.js");
const DATABASE = require("../lib/database");
const MEETINGS = require("../lib/meetings.js");
const TIME = require("../lib/time.js");
const REST_UTILS = require("./rest-utils.js")(DATABASE);
const AUTO = require("../lib/automation.js");

// Schedule a new meeting
router.get("/schedule", async function (req, res) {
  try {
    // Fetch Google Emails
    const googleEmails = await REST_UTILS.tryFetchGoogleEmails(req, res);
    if (!googleEmails) return;

    let title = JSON.parse(decodeURIComponent(req.query.title));
    title = title.substring(1, title.length - 1);

    const duration = JSON.parse(decodeURIComponent(req.query.duration));
    const startDateRange = TIME.maintainLocalTimeZone(
      JSON.parse(decodeURIComponent(req.query.startDateRange))
    );
    const endDateRange = TIME.maintainLocalTimeZone(
      JSON.parse(decodeURIComponent(req.query.endDateRange))
    );
    const startTimeRange = TIME.maintainLocalTimeZone(
      JSON.parse(decodeURIComponent(req.query.startTimeRange))
    );
    const endTimeRange = TIME.maintainLocalTimeZone(
      JSON.parse(decodeURIComponent(req.query.endTimeRange))
    );
    const flexible = JSON.parse(decodeURIComponent(req.query.flexible));
    const dayOfWeek = JSON.parse(decodeURIComponent(req.query.dayOfWeek));
    const timeRangeSpecified = JSON.parse(
      decodeURIComponent(req.query.timeRangeSpecified)
    );

    const chosenSlot = await MEETINGS.schedule(
      googleEmails,
      title,
      duration,
      startDateRange,
      endDateRange,
      startTimeRange,
      endTimeRange,
      flexible,
      dayOfWeek,
      timeRangeSpecified
    );

    if (!chosenSlot) {
      console.warn("SCHEDULE: No Slot Found");
      res.json({
        info:
          "Sorry, we can't find an available slot that meets your preferences",
      });
      return;
    }

    res.json(chosenSlot);
  } catch (err) {
    // Any other type of error
    const msg = "REST schedule Error: " + err.message;
    console.error(msg);
    res.json({ error: msg });
  }
});

// Reschedule an existing meeting
router.get("/reschedule", async function (req, res) {
  try {
    // Fetch Google Email
    const googleEmail = await REST_UTILS.tryFetchGoogleEmail(req, res);
    if (!googleEmail) return;

    // Check that either an event time or title has been specified.
    if (!req.query.oldDateTime && !req.query.oldTitle) {
      res.json({ error: "No event time or title specified for rescheduling." });
    }

    let oldTitle = JSON.parse(decodeURIComponent(req.query.oldTitle));
    oldTitle = oldTitle.substring(1, oldTitle.length - 1);

    const oldDateTime = TIME.maintainLocalTimeZone(
      JSON.parse(decodeURIComponent(req.query.oldDateTime))
    );
    const newStartDateRange = TIME.maintainLocalTimeZone(
      JSON.parse(decodeURIComponent(req.query.newStartDateRange))
    );
    const newEndDateRange = TIME.maintainLocalTimeZone(
      JSON.parse(decodeURIComponent(req.query.newEndDateRange))
    );
    const newStartTimeRange = TIME.maintainLocalTimeZone(
      JSON.parse(decodeURIComponent(req.query.newStartTimeRange))
    );
    const newEndTimeRange = TIME.maintainLocalTimeZone(
      JSON.parse(decodeURIComponent(req.query.newEndTimeRange))
    );
    const newDayOfWeek = JSON.parse(decodeURIComponent(req.query.newDayOfWeek));
    const dateRangeSpecified = JSON.parse(
      decodeURIComponent(req.query.dateRangeSpecified)
    );
    const timeRangeSpecified = JSON.parse(
      decodeURIComponent(req.query.timeRangeSpecified)
    );
    const flexible = JSON.parse(decodeURIComponent(req.query.flexible));

    if (!oldDateTime && !oldTitle) {
      res.json({ error: "You must specify the event title or date and time" });
      return;
    }

    const chosenSlot = await MEETINGS.reschedule(
      googleEmail,
      oldTitle,
      oldDateTime,
      newStartDateRange,
      newEndDateRange,
      newStartTimeRange,
      newEndTimeRange,
      newDayOfWeek,
      dateRangeSpecified,
      timeRangeSpecified,
      flexible
    );

    if (!chosenSlot) {
      console.warn("SCHEDULE: No Slot Found");
      res.json({
        info:
          "Sorry, we can't find an available slot that meets your preferences",
      });
      return;
    }

    res.json(chosenSlot);
  } catch (err) {
    // Any other type of error
    const msg = "REST reschedule Error: " + err.message;
    console.error(msg);
    res.json({ error: msg });
  }
});

// Retrieve all meetings
router.get("/meetings", async function (req, res) {
  try {
    // Fetch Google Email
    const googleEmail = await REST_UTILS.tryFetchGoogleEmail(req, res);
    if (!googleEmail) return;

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
  } catch (err) {
    // Any other type of error
    const msg = "REST meetings Error: " + err.message;
    console.error(msg);
    res.json({ error: msg });
  }
});

// Add constraints
router.get("/constraints", async function (req, res) {
  try {
    // Fetch Google Email
    const googleEmail = await REST_UTILS.tryFetchGoogleEmail(req, res);
    if (!googleEmail) return;

    if (!req.query.busyTimes) {
      res.json({ error: "Busy times not found" });
    }

    if (!req.query.busyDays) {
      res.json({ error: "Busy days not found" });
      return;
    }

    const days = JSON.parse(decodeURIComponent(req.query.busyDays));
    const times = JSON.parse(decodeURIComponent(req.query.busyTimes));

    await MEETINGS.setConstraints(googleEmail, days, times);

    res.send({ success: true });
  } catch (err) {
    // Any other type of error
    const msg = "REST constraints Error: " + err.message;
    console.error(msg);
    res.json({ error: msg });
  }
});

// set min break length
router.get("/set-min-break", async function (req, res) {
  try {
    // Fetch Google Email
    const googleEmail = await REST_UTILS.tryFetchGoogleEmail(req, res);
    if (!googleEmail) return;

    if (!req.query.minBreakLength) {
      res.json({ error: "Break length not provided" });
    }

    const breakMinutes = JSON.parse(
      decodeURIComponent(req.query.minBreakLength)
    );
    if (!breakMinutes) {
      // break can't be in seconds/milliseconds/... at least minutes
      res.send({ error: "Please Give Your Required Break Length In Minutes" });
      return;
    }
    if (breakMinutes < 0) {
      res.send({ error: "Breaks Can't Be Negative" });
      return;
    }
    await DATABASE.setMinBreakLength(googleEmail, breakMinutes);
    res.send({ success: true });
  } catch (err) {
    // Any other type of error
    const msg = "REST set-min-break Error: " + err.message;
    console.error(msg);
    res.json({ error: msg });
  }
});

// Cancel event
router.get("/cancel", async function (req, res) {
  try {
    // Fetch Google Email
    const googleEmail = await REST_UTILS.tryFetchGoogleEmail(req, res);
    if (!googleEmail) return;

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
          !TIME.compareDateTime(events[0].start.dateTime, meetingDateTime))
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
  } catch (err) {
    // Any other type of error
    const msg = "REST cancel Error: " + err.message;
    console.error(msg);
    res.json({ error: msg });
  }
});

// Recalibrate preferences
router.get("/preferences", async function (req, res) {
  try {
    // Set preferences timeout to be 5 minutes (5 * 60 * 1000)
    req.setTimeout(300e3);

    // Fetch Google Email
    const googleEmail = await REST_UTILS.tryFetchGoogleEmail(req, res);
    if (!googleEmail) return;

    // Generate User preferences
    await MEETINGS.generatePreferences(googleEmail, tokens);

    res.send({ success: true });
  } catch (err) {
    // Any other type of error
    const msg = "REST preferences Error: " + err.message;
    console.error(msg);
    res.json({ error: msg });
  }
});

// Auto reschedule events
router.get("/auto-reschedule", async function () {
  try {
    // Fetch Google Email
    const googleEmail = await REST_UTILS.tryFetchGoogleEmail(req, res);
    if (!googleEmail) return;

    const organiserToken = JSON.parse(
      decodeURIComponent(await DATABASE.getTokenFromGoogleEmail(googleEmail))
    );

    await AUTO.rescheduleAll(googleEmail, organiserToken, true);

    res.json({ success: true });
  } catch (err) {
    // Any other type of error
    const msg = "REST autoreschedule Error: " + err.message;
    console.error(msg);
    res.json({ error: msg });
  }
});

module.exports = router;
