const assert = require('assert');

const {DateTime} = require('luxon');

const GOOGLE = require('../lib/google.js');
const DATABASE = require('../lib/database.js');
const MEETINGS = require('../lib/meetings.js');

const mocha = require('mocha');
const describe = mocha.describe;
const it = mocha.it;

describe('Scheduling in a given range', () => {
  it('should book correctly', async () => {
    const tomorrow = DateTime.local().plus({days: 1});
    const tomorrowTwelveHours = DateTime.local(tomorrow.year, tomorrow.month, tomorrow.day, 12);
    const tomorrowEighteenHours = DateTime.local(tomorrow.year, tomorrow.month, tomorrow.day, 18);
    const ONE_HOUR = 60;

    const testEmails = ['s.amnabidi@gmail.com']; // TODO: Change to a test email account
    const testToken = JSON.parse(await DATABASE.getToken(testEmails[0]));

    MEETINGS.schedule(undefined, testEmails, tomorrowTwelveHours.toISO(),
        tomorrowEighteenHours.toISO(), true, ONE_HOUR);

    const meetingSlot = MEETINGS.schedule(undefined, testEmails, tomorrowTwelveHours.toISO(),
        tomorrowEighteenHours.toISO(), true, ONE_HOUR);
    const events = GOOGLE.getEvents(testToken, meetingSlot.start);

    assert.strictEqual(events.length(), 1);
  });
});
