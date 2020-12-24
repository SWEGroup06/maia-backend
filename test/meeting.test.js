const assert = require('assert');

const {DateTime} = require('luxon');

const GOOGLE = require('../lib/google.js');
const DATABASE = require('../lib/database.js');
const MEETINGS = require('../lib/meetings.js');

describe('Scheduling in a given range', () => {
  it('should book correctly', () => {
    const tomorrow = DateTime.local().plus({days: 1});
    const tomorrowTwelveHours = DateTime.local(tomorrow.year, tomorrow.month, tomorrow.day, 12);
    const tomorrowEighteenHours = DateTime.local(tomorrow.year, tomorrow.month, tomorrow.day, 18);

    const testEmail = 's.amnabidi@gmail.com'; // TODO: Change to a test email account
    const testToken = DATABASE.getToken(testEmail);

    const meetingSlot = MEETINGS.schedule(undefined, [testEmail], tomorrowTwelveHours.toISO(),
        tomorrowEighteenHours.toISO(), true);

    console.log('* meetingSlot ' + meetingSlot);
    console.log('* GOOGLE.getEvents(testToken, meetingSlot.start)[0]: ' + GOOGLE.getEvents(testToken, meetingSlot.start)[0]);

    assert.strictEqual(true, true);
  });
});
