require("dotenv").config();

const assert = require("assert");

// const GOOGLE = require("../lib/google.js");
const DATABASE = require("../lib/database.js");

const { describe, it, before, after } = require("mocha");

describe("Testing setting and fetching from database", function () {
  before(async () => {
    await DATABASE.getDatabaseConnection(true);
    // const token = JSON.parse(
    //   await DATABASE.getTokenFromGoogleEmail(process.env.TEST_ACCOUNT_EMAIL)
    // );
  });

  it("Get constraints returns constraints previously set", async function () {
    const email = process.env.TEST_ACCOUNT_EMAIL;
    const expected = Array(7)
      .fill(0)
      .map((_) => [
        {
          startTime: "2021-01-05T09:00:00.000+00:00",
          endTime: "2021-01-05T09:00:00.000+00:00",
        },
      ]);
    await DATABASE.setConstraintsGivenFullArray(email, expected);
    const res = await DATABASE.getConstraintsFromGoogleEmail(email);
    const output = JSON.parse(
      JSON.stringify(
        res.map((e) => [
          {
            startTime: e[0].startTime,
            endTime: e[0].endTime,
          },
        ])
      )
    );
    assert.deepStrictEqual(expected, output);
  });

  it("Get minimum break length returns minimum break length previously set", async function () {
    const email = process.env.TEST_ACCOUNT_EMAIL;
    const expected = Math.floor(Math.random() * 100);
    await DATABASE.setMinBreakLength(email, expected);
    const output = await DATABASE.getMinBreakLength(email);
    assert.deepStrictEqual(expected, output);
  });

  after(async () => {
    await DATABASE.closeDatabaseConnection();
  });
});
