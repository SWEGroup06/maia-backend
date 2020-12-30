require('dotenv').config();

const assert = require('assert');

const {DateTime} = require('luxon');

const GOOGLE = require('../lib/google.js');
const DATABASE = require('../lib/database.js');
const MEETINGS = require('../lib/meetings.js');
const TIME = require('../lib/time.js');

const mocha = require('mocha');
const {describe, it, before, after} = mocha;

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
//     const tomorrowNineHoursThirtyMinutes = DateTime.local(tomorrow.year, tomorrow.month, tomorrow.day, 9, 30);
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

/**
 * TODO: Comment
 */
describe('Scheduling in a given range', function() {
  const tomorrow = DateTime.local().plus({days: 1});
  const ONE_HOUR = 60;
  const HALF_HOUR = 30;

  before(async () => {
    await DATABASE.getDatabaseConnection();
    const token = JSON.parse(await DATABASE.getTokenFromGoogleEmail('syedalimehdinaoroseabidi@gmail.com'));
    await GOOGLE.clearCalendar(token);
  });

  // TODO: Doesn't get correct event because of scheduler.
  it('should book a single flexible one-hour event between 12pm and 6pm', async () => {
    const tomorrowTwelveHours = DateTime.local(tomorrow.year, tomorrow.month, tomorrow.day, 12);
    const tomorrowEighteenHours = DateTime.local(tomorrow.year, tomorrow.month, tomorrow.day, 18);

    const testEmails = ['syedalimehdinaoroseabidi@gmail.com']; // TODO: Change to a test email account
    const testToken = JSON.parse(await DATABASE.getTokenFromGoogleEmail(testEmails[0]));

    // Using the scheduler, find an appropriate slot for this one hour meeting.
    const meetingSlot = await MEETINGS.schedule(undefined, testEmails, tomorrowTwelveHours.toISO(),
        tomorrowEighteenHours.toISO(), true, ONE_HOUR);

    // Check the Google Calendar for an event starting at the slot time given by the scheduler.
    const event = await GOOGLE.getEvent(testToken, meetingSlot.start);

    assert.notStrictEqual(event, null, 'event should exist, i.e. not be null');
    assert.strictEqual(TIME.isBetweenTimes(event.start.dateTime, tomorrowTwelveHours, tomorrowEighteenHours), true);
    assert.strictEqual(TIME.getDurationInMinutes(event.start.dateTime, event.end.dateTime), ONE_HOUR);
  });

  it('should book a single non-flexible half-hour event between 7pm and 8:30pm', async () => {
    const tomorrowNinteenHours = DateTime.local(tomorrow.year, tomorrow.month, tomorrow.day, 19);
    const tomorrowTwentyHoursThirtyMinutes = DateTime.local(tomorrow.year, tomorrow.month, tomorrow.day, 20, 30);

    const testEmails = ['syedalimehdinaoroseabidi@gmail.com']; // TODO: Change to a test email account
    const testToken = JSON.parse(await DATABASE.getTokenFromGoogleEmail(testEmails[0]));

    const meetingSlot = await MEETINGS.schedule(undefined, testEmails, tomorrowNinteenHours.toISO(),
        tomorrowTwentyHoursThirtyMinutes.toISO(), true, HALF_HOUR);

    const event = await GOOGLE.getEvent(testToken, meetingSlot.start);

    assert.notStrictEqual(event, null, 'event should exist, i.e. not be null');
    assert.strictEqual(TIME
        .isBetweenTimes(event.start.dateTime, tomorrowNinteenHours, tomorrowTwentyHoursThirtyMinutes), true);
    assert.strictEqual(TIME.getDurationInMinutes(event.start.dateTime, event.end.dateTime), HALF_HOUR);
  });

  after(async () => {
    await DATABASE.closeDatabaseConnection();
  });
});
