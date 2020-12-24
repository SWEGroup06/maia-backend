/**
 * @fileOverview This test file holds various test cases regarding the scheduling/creation of
 * meetings/events by the user.
 * @package
 */

const {DateTime} = require('luxon');

// const DIALOGFLOW = require('../lib/dialogflow.js');
const GOOGLE = require('../lib/google.js');
const DATABASE = require('../lib/database.js');
const MEETINGS = require('../lib/meetings.js');
// const SCHEDULER = require('../src/scheduler');

/**
 * // TODO:
 * @param {String} title
 * @param {Array} emails
 * @param {DateTime} startDateTimeOfRange
 * @param {DateTime} endDateTimeOfRange
 * @param {boolean} flexible
 * @param {String} beforeAfterKey
 * @return {{emails: [], flexible: boolean, startDateTimeOfRange: string, title: string, endDateTimeOfRange: string, beforeAfterKey: string}}
 */
function generateRequest(title, emails, startDateTimeOfRange, endDateTimeOfRange, flexible, beforeAfterKey) {
  return {
    title: title,
    emails: emails,
    startDateTimeOfRange: startDateTimeOfRange.toISO(),
    endDateTimeOfRange: endDateTimeOfRange.toISO(),
    flexible: flexible,
    beforeAfterKey: beforeAfterKey,
  };
}

// TODO: Create a test user
test('Book event between 12pm and 6pm tomorrow', () => {
  const tomorrow = DateTime.local().plus({days: 1});
  const tomorrowTwelveHours = DateTime.local(tomorrow.year, tomorrow.month, tomorrow.day, 12);
  const tomorrowEighteenHours = DateTime.local(tomorrow.year, tomorrow.month, tomorrow.day, 18);

  const testEmail = 's.amnabidi@gmail.com'; // TODO: Change to a test email account
  const testToken = DATABASE.getToken(testEmail);

  const meetingSlot = MEETINGS.schedule(undefined, [testEmail], tomorrowTwelveHours.toISO(),
      tomorrowEighteenHours.toISO(), true);

  console.log('* meetingSlot.start: ' + meetingSlot.start);
  console.log('* GOOGLE.getEvents(testToken, meetingSlot.start)[0]: ' + GOOGLE.getEvents(testToken, meetingSlot.start)[0]);

  // expect(GOOGLE.getEvents(testToken, meetingSlot.start)[0]).toEqual();
});
