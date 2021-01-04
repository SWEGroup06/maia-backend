require("dotenv").config();

const assert = require("assert");

const { DateTime } = require("luxon");

const GOOGLE = require("../lib/google.js");
const DATABASE = require("../lib/database.js");
const MEETINGS = require("../lib/meetings.js");
const TIME = require("../lib/time.js");

// const TODAY = DateTime.local();
const TOMORROW = DateTime.local().plus({ days: 1 });
// const ONE_HOUR = 60;

const mocha = require("mocha");
const { describe, it, before, after } = mocha;

/**
 * TODO: Comment
 */
// describe('Scheduling at a specific time', function() {
//   const tomorrow = DateTime.local().plus({days: 1});
//
//   before(async () => {
//     await DATABASE.getDatabaseConnection();
//     const token = JSON.parse(await DATABASE.getTokenFromGoogleEmail('s.amnabidi@gmail.com'));
//     await GOOGLE.clearCalendar(token);
//   });
//
//   it('should book a one-hour event at 9:30am tomorrow', async () => {
//     const tomorrowNineHoursThirtyMinutes = DateTime.local(TOMORROW.year, TOMORROW.month, TOMORROW.day, 9, 30);
//     const ONE_HOUR = 60;
//
//     const testEmails = ['s.amnabidi@gmail.com']; // TODO: Change to a test email account
//     const testToken = JSON.parse(await DATABASE.getTokenFromGoogleEmail(testEmails[0]));
//
//     const meetingSlot = await MEETINGS.schedule(undefined, testEmails, tomorrowNineHoursThirtyMinutes.toISO(),
//         tomorrowEighteenHours.toISO(), true, ONE_HOUR);
//
//     const events = await GOOGLE.getEvents(testToken, meetingSlot.start);
//
//     assert.strictEqual(events.length, 1);
//   });
//
//   after(async () => {
//     await DATABASE.closeDatabaseConnection();
//   });
// });

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

  it("should book a single one-hour event between 12pm and 6pm", async () => {
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
    // to a test email
    // account
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

  /**
  // TODO: Doesn't get correct event because of scheduler.
  it("should book a single non-flexible half-hour event between 7pm and 8:30pm", async () => {
    const tomorrowNinteenHours = DateTime.local(
      TOMORROW.year,
      TOMORROW.month,
      TOMORROW.day,
      19
    );
    const tomorrowTwentyHoursThirtyMinutes = DateTime.local(
      TOMORROW.year,
      TOMORROW.month,
      TOMORROW.day,
      20,
      30
    );
   
    const testEmails = ["syedalimehdinaoroseabidi@gmail.com"]; // TODO: Change to a test email account
    const testToken = JSON.parse(
      await DATABASE.getTokenFromGoogleEmail(testEmails[0])
    );
   
    // Using the scheduler, find an appropriate slot for this half an hour meeting.
    const meetingSlot = await MEETINGS.schedule(
      undefined,
      testEmails,
      tomorrowNinteenHours.toISO(),
      tomorrowTwentyHoursThirtyMinutes.toISO(),
      true,
      HALF_HOUR
    );
   
    // Check the Google Calendar for an event starting at the slot time given by the scheduler.
    const event = await GOOGLE.getEvent(testToken, meetingSlot.start);
   
    assert.notStrictEqual(event, null, "event should exist, i.e. not be null");
    assert.strictEqual(
      TIME.isBetweenTimes(
        event.start.dateTime,
        tomorrowNinteenHours,
        tomorrowTwentyHoursThirtyMinutes
      ),
      true,
      "start time of event should be between 7pm and 8:30pm"
    );
    assert.strictEqual(
      TIME.getDurationInMinutes(event.start.dateTime, event.end.dateTime),
      HALF_HOUR,
      "event should be half an hour long, as specified."
    );
  });
   **/

  after(async () => {
    await DATABASE.closeDatabaseConnection();
  });
});

/**
 * Set of tests relating to scheduling an event over a range of dates rather than a range of times.
 * e.g. rescheduling to next week, next month, March, etc.
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
