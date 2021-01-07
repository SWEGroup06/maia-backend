require("dotenv").config();

// const assert = require("assert");

// const { DateTime } = require("luxon");

const GOOGLE = require("../lib/google.js");
const DATABASE = require("../lib/database.js");
// const MEETINGS = require("../lib/meetings.js");
// const TIME = require("../lib/time.js");

const { describe, it, before, after } = require("mocha");

// TODO: Implement
describe("Detecting work and leisure events and booking them appropriately", function () {
  before(async () => {
    await DATABASE.getDatabaseConnection(true);
    const token = JSON.parse(
      await DATABASE.getTokenFromGoogleEmail(process.env.TEST_ACCOUNT_EMAIL)
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
    await DATABASE.closeDatabaseConnection();
  });
});
