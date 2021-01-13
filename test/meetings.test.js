require("dotenv").config();

const assert = require("assert");

const { DateTime } = require("luxon");

const GOOGLE = require("../lib/google.js");
const DATABASE = require("../lib/database.js");
const MEETINGS = require("../lib/meetings.js");
const TIME = require("../lib/time.js");

const TODAY = DateTime.local().startOf("day");
const TOMORROW = TODAY.plus({ days: 1 });
const ONE_HOUR = 60;

const { describe, it, before, after } = require("mocha");

describe("Scheduling at a specific time", function () {
  before(async () => {
    await DATABASE.getDatabaseConnection(true);
    const token = JSON.parse(
      await DATABASE.getTokenFromGoogleEmail(process.env.TEST_ACCOUNT_EMAIL)
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

    const testEmails = [process.env.TEST_ACCOUNT_EMAIL]
    const testToken = await DATABASE.getTokenFromGoogleEmail(testEmails[0]);

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
      TIME.compareDateTime(
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

  it("should book a two-hour event at 8pm day after tomorrow", async () => {
    const DAY_AFTER_TOMORROW = TOMORROW.plus({ days: 1 });
    const dayAfterTomorrowTwentyHours = DateTime.local(
      DAY_AFTER_TOMORROW.year,
      DAY_AFTER_TOMORROW.month,
      DAY_AFTER_TOMORROW.day,
      20,
      0
    );

    const testEmails = [process.env.TEST_ACCOUNT_EMAIL]
    const testToken = await DATABASE.getTokenFromGoogleEmail(testEmails[0]);

    const meetingSlot = await MEETINGS.schedule(
      testEmails,
      undefined,
      ONE_HOUR * 2,
      DAY_AFTER_TOMORROW.startOf("day").toISO(),
      DAY_AFTER_TOMORROW.endOf("day").toISO(),
      dayAfterTomorrowTwentyHours.toISO(),
      dayAfterTomorrowTwentyHours.toISO(),
      false,
      undefined,
      true
    );

    const event = await GOOGLE.getEvent(testToken, meetingSlot.start);

    assert.notStrictEqual(event, null, "event should exist, i.e. not be null");
    assert.strictEqual(
      TIME.compareDateTime(
        event.start.dateTime,
        dayAfterTomorrowTwentyHours.toISO()
      ),
      true,
      "event should start at 8pm as specified"
    );
    assert.strictEqual(
      TIME.getDurationInMinutes(event.start.dateTime, event.end.dateTime),
      ONE_HOUR * 2,
      "event should be exactly two hour long, as specified."
    );
  });

  it("should book a two-hour event at 8pm day after tomorrow again", async () => {
    // If the user defines a specific time where they would like a meeting,
    // yet there is already an event in that space, book it for them anyway.
    const DAY_AFTER_TOMORROW = TOMORROW.plus({ days: 1 });
    const dayAfterTomorrowTwentyHours = DateTime.local(
      DAY_AFTER_TOMORROW.year,
      DAY_AFTER_TOMORROW.month,
      DAY_AFTER_TOMORROW.day,
      20,
      0
    );

    const testEmails = [process.env.TEST_ACCOUNT_EMAIL]
    const testToken = await DATABASE.getTokenFromGoogleEmail(testEmails[0]);

    const meetingSlot = await MEETINGS.schedule(
      testEmails,
      undefined,
      ONE_HOUR * 2,
      DAY_AFTER_TOMORROW.startOf("day").toISO(),
      DAY_AFTER_TOMORROW.endOf("day").toISO(),
      dayAfterTomorrowTwentyHours.toISO(),
      dayAfterTomorrowTwentyHours.toISO(),
      false,
      undefined,
      true
    );

    const event = await GOOGLE.getEvent(testToken, meetingSlot.start);

    assert.notStrictEqual(event, null, "event should exist, i.e. not be null");
    assert.strictEqual(
      TIME.compareDateTime(
        event.start.dateTime,
        dayAfterTomorrowTwentyHours.toISO()
      ),
      true,
      "event should start at 8pm as specified"
    );
    assert.strictEqual(
      TIME.getDurationInMinutes(event.start.dateTime, event.end.dateTime),
      ONE_HOUR * 2,
      "event should be exactly two hour long, as specified."
    );
  });

  after(async () => {
    await DATABASE.closeDatabaseConnection();
  });
});

describe("Scheduling within a given time range", function () {
  const ONE_HOUR = 60;

  before(async () => {
    await DATABASE.getDatabaseConnection(true);
    const token = JSON.parse(
      await DATABASE.getTokenFromGoogleEmail(process.env.TEST_ACCOUNT_EMAIL)
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

    const testEmails = [process.env.TEST_ACCOUNT_EMAIL]
    const testToken = await DATABASE.getTokenFromGoogleEmail(testEmails[0]);

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

    const testEmails = [process.env.TEST_ACCOUNT_EMAIL]
    const testToken = await DATABASE.getTokenFromGoogleEmail(testEmails[0]);

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

    const testEmails = [process.env.TEST_ACCOUNT_EMAIL]
    const testToken = await DATABASE.getTokenFromGoogleEmail(testEmails[0]);

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
    await DATABASE.getDatabaseConnection(true);
    const token = JSON.parse(
      await DATABASE.getTokenFromGoogleEmail(process.env.TEST_ACCOUNT_EMAIL)
    );
    await GOOGLE.clearCalendar(token);
  });

  after(async () => {
    await DATABASE.closeDatabaseConnection();
  });
});
