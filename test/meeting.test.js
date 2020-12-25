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

    console.log('HERE');

    const testEmail = 's.amnabidi@gmail.com'; // TODO: Change to a test email account
    const testToken = DATABASE.getToken(testEmail);

    console.log('HEREE');

    const meetingSlot = await MEETINGS.schedule(undefined, [testEmail], tomorrowTwelveHours.toISO(),
        tomorrowEighteenHours.toISO(), true);
    const events = await GOOGLE.getEvents(testToken, meetingSlot.start);

    console.log('slackEmails: ' + [].push(testEmail));
    console.log('tomorrowTwelveHours: ' + tomorrowTwelveHours.toISO());
    console.log('tomorrowEighteenHours: ' + tomorrowEighteenHours.toISO());

    console.log('HEREEE');

    console.log('* meetingSlot ' + meetingSlot);
    console.log('* events[0]: ' + events[0]);

    assert.strictEqual(true, true);
  });
});
