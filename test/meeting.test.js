require("dotenv").config();

const assert = require("assert");

const { DateTime } = require("luxon");

const GOOGLE = require("../lib/google.js");
const DATABASE = require("../lib/database.js");
const MEETINGS = require("../lib/meetings.js");
const TIME = require("../lib/time.js");

// const TODAY = DateTime.local();
const TOMORROW = DateTime.local().plus({ days: 1 });
const ONE_HOUR = 60;

const { describe, it, before, after } = require("mocha");

/**
 * TODO: Comment
 */
describe("Scheduling at a specific time", function () {
  before(async () => {
    await DATABASE.getDatabaseConnection();
    const token = JSON.parse(
      await DATABASE.getTokenFromGoogleEmail(
        "syedalimehdinaoroseabidi@gmail.com"
      )
    );
    await GOOGLE.clearCalendar(token);
  });

  it("should book a one-hour event at 9:30am tomorrow", async () => {
    const tomorrowNineHoursThirtyMinutes = DateTime.local(
      TOMORROW.year,
      TOMORROW.month,
      TOMORROW.day,
      9,
      30
    );

    const testEmails = ["syedalimehdinaoroseabidi@gmail.com"]; // TODO: Change
    const testToken = JSON.parse(
      await DATABASE.getTokenFromGoogleEmail(testEmails[0])
    );

    const meetingSlot = await MEETINGS.schedule(
      testEmails,
      undefined,
      ONE_HOUR,
      TOMORROW.startOf("day").toISO(),
      TOMORROW.endOf("day").toISO(),
      tomorrowNineHoursThirtyMinutes.toISO(),
      tomorrowNineHoursThirtyMinutes.toISO(),
      false,
      undefined,
      true
    );

    const event = await GOOGLE.getEvent(testToken, meetingSlot.start);

    assert.notStrictEqual(event, null, "event should exist, i.e. not be null");
    assert.strictEqual(
      TIME.compareTime(
        event.start.dateTime,
        tomorrowNineHoursThirtyMinutes.toISO()
      ),
      true
    );
    assert.strictEqual(
      TIME.getDurationInMinutes(event.start.dateTime, event.end.dateTime),
      ONE_HOUR,
      "event should be exactly one hour long, as specified."
    );
  });

  after(async () => {
    await DATABASE.closeDatabaseConnection();
  });
});

describe("Scheduling within a given time range", function () {
  const ONE_HOUR = 60;

  before(async () => {
    await DATABASE.getDatabaseConnection();
    const token = JSON.parse(
      await DATABASE.getTokenFromGoogleEmail(
        "syedalimehdinaoroseabidi@gmail.com"
      )
    );
    await GOOGLE.clearCalendar(token);
  });

  it("should book one-hour event tomorrow between 12pm and 6pm", async () => {
    const tomorrowTwelveHours = DateTime.local(
      TOMORROW.year,
      TOMORROW.month,
      TOMORROW.day,
      12
    );
    const tomorrowEighteenHours = DateTime.local(
      TOMORROW.year,
      TOMORROW.month,
      TOMORROW.day,
      18
    );

    const testEmails = ["syedalimehdinaoroseabidi@gmail.com"]; // TODO: Change
    const testToken = JSON.parse(
      await DATABASE.getTokenFromGoogleEmail(testEmails[0])
    );

    const meetingSlot = await MEETINGS.schedule(
      testEmails,
      undefined,
      ONE_HOUR,
      TOMORROW.startOf("day").toISO(),
      TOMORROW.endOf("day").toISO(),
      tomorrowTwelveHours.toISO(),
      tomorrowEighteenHours.toISO(),
      true,
      undefined,
      true
    );

    const event = await GOOGLE.getEvent(testToken, meetingSlot.start);

    assert.notStrictEqual(event, null, "event should exist, i.e. not be null");
    assert.strictEqual(
      TIME.isBetweenTimes(
        event.start.dateTime,
        tomorrowTwelveHours,
        tomorrowEighteenHours
      ),
      true,
      "start time of the event should be between 12pm and 6pm."
    );
    assert.strictEqual(
      TIME.getDurationInMinutes(event.start.dateTime, event.end.dateTime),
      ONE_HOUR,
      "event should be exactly one hour long, as specified."
    );
  });

  it("should book three-hour event tomorrow between 7:15pm and 11:45pm", async () => {
    const tomorrowNineteenHoursFifteenMinutes = DateTime.local(
      TOMORROW.year,
      TOMORROW.month,
      TOMORROW.day,
      19,
      15
    );
    const tomorrowTwentyThreeHoursFortyFiveMinutes = DateTime.local(
      TOMORROW.year,
      TOMORROW.month,
      TOMORROW.day,
      23,
      45
    );

    const testEmails = ["syedalimehdinaoroseabidi@gmail.com"]; // TODO: Change
    const testToken = JSON.parse(
      await DATABASE.getTokenFromGoogleEmail(testEmails[0])
    );

    const meetingSlot = await MEETINGS.schedule(
      testEmails,
      undefined,
      ONE_HOUR * 3,
      TOMORROW.startOf("day").toISO(),
      TOMORROW.endOf("day").toISO(),
      tomorrowNineteenHoursFifteenMinutes.toISO(),
      tomorrowTwentyThreeHoursFortyFiveMinutes.toISO(),
      true,
      undefined,
      true
    );

    const event = await GOOGLE.getEvent(testToken, meetingSlot.start);

    assert.notStrictEqual(event, null, "event should exist, i.e. not be null");
    assert.strictEqual(
      TIME.isBetweenTimes(
        event.start.dateTime,
        tomorrowNineteenHoursFifteenMinutes,
        tomorrowTwentyThreeHoursFortyFiveMinutes
      ),
      true,
      "start time of the event should be between 7:15pm and 11:45pm."
    );
    assert.strictEqual(
      TIME.getDurationInMinutes(event.start.dateTime, event.end.dateTime),
      ONE_HOUR * 3,
      "event should be exactly three hours long, as specified."
    );
  });

  it("should book 15 minute titled meeting tomorrow between 8am and 11am", async () => {
    const tomorrowEightHours = DateTime.local(
      TOMORROW.year,
      TOMORROW.month,
      TOMORROW.day,
      8
    );
    const tomorrowElevenHours = DateTime.local(
      TOMORROW.year,
      TOMORROW.month,
      TOMORROW.day,
      11
    );

    const testEmails = ["syedalimehdinaoroseabidi@gmail.com"]; // TODO: Change
    const testToken = JSON.parse(
      await DATABASE.getTokenFromGoogleEmail(testEmails[0])
    );

    const TITLE = "scrum meeting";
    const meetingSlot = await MEETINGS.schedule(
      testEmails,
      TITLE,
      15,
      TOMORROW.startOf("day").toISO(),
      TOMORROW.endOf("day").toISO(),
      tomorrowEightHours.toISO(),
      tomorrowElevenHours.toISO(),
      true,
      undefined,
      true
    );

    const event = await GOOGLE.getEvent(testToken, meetingSlot.start);

    assert.notStrictEqual(event, null, "event should exist, i.e. not be null");
    assert.strictEqual(
      event.summary,
      TITLE,
      "event should have original meeting title"
    );
    assert.strictEqual(
      TIME.isBetweenTimes(
        event.start.dateTime,
        tomorrowEightHours,
        tomorrowElevenHours
      ),
      true,
      "start time of the event should be between 8am and 11am."
    );
    assert.strictEqual(
      TIME.getDurationInMinutes(event.start.dateTime, event.end.dateTime),
      15,
      "event should be exactly 15 minutes long, as specified."
    );
  });

  after(async () => {
    await DATABASE.closeDatabaseConnection();
  });
});

/**
 * Set of tests relating to scheduling an event over a range of dates rather
 * than a range of times. e.g. rescheduling to next week, next month, etc.
 */
describe("Scheduling within a given date range", function () {
  before(async () => {
    await DATABASE.getDatabaseConnection();
    const token = JSON.parse(
      await DATABASE.getTokenFromGoogleEmail(
        "syedalimehdinaoroseabidi@gmail.com"
      )
    );
    await GOOGLE.clearCalendar(token);
  });

  // TODO:

  after(async () => {
    await DATABASE.closeDatabaseConnection();
  });
});
