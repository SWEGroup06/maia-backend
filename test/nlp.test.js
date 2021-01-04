require("dotenv").config();

const assert = require("assert");

const { DateTime } = require("luxon");

const GOOGLE = require("../lib/google.js");
const TEST_DATABASE = require("../lib/database.js");
const MEETINGS = require("../lib/meetings.js");
const TIME = require("../lib/time.js");

const mocha = require("mocha");
const { describe, it, before, after } = mocha;

// TODO: Implement
describe("Detecting work and leisure events and booking them appropriately", function () {
  before(async () => {
    await TEST_DATABASE.getDatabaseConnection();
    const token = JSON.parse(
      await TEST_DATABASE.getTokenFromGoogleEmail(
        "syedalimehdinaoroseabidi@gmail.com"
      )
    );
    await GOOGLE.clearCalendar(token);
  });

  it("should detect leisure event and then book it for the evening, after work, if weekday is specified", async () => {
    // TODO:
  });

  it("should detect leisure event and then book a leisure event on the weekend", async () => {
    // TODO:
  });

  it("should detect work event and then book it for work hours on a weekday", async () => {
    // TODO:
  });

  after(async () => {
    await TEST_DATABASE.closeDatabaseConnection();
  });
});
