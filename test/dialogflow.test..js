require("dotenv").config();

const assert = require("assert");

const DIALOGFLOW = require("../lib/dialogflow.js");

const { describe, it } = require("mocha");

const categories = [
  "unknown",
  "social",
  "work",
  "breakfast",
  "lunch",
  "dinner",
];

const getCategory = async function (title) {
  return categories[(await DIALOGFLOW.getCategory(title)) + 1];
};

describe("Checking if the NLP algorithm correctly determines the command type", function () {
  it("should detect a login command", async () => {
    const query = "sign up";
    const res = await DIALOGFLOW.sendQuery(query, true);
    assert.strictEqual(res.type, "login");
  });

  it("should detect a schedule command", async () => {
    const query = "book a meeting for tomorrow";
    const res = await DIALOGFLOW.sendQuery(query, true);
    assert.strictEqual(res.type, "schedule");
  });

  it("should detect a reschedule command", async () => {
    const query = "reschedule a meeting on Friday at 1pm";
    const res = await DIALOGFLOW.sendQuery(query, true);
    assert.strictEqual(res.type, "reschedule");
  });

  it("should detect a cancel command", async () => {
    const query = "delete my meeting on 7th March";
    const res = await DIALOGFLOW.sendQuery(query, true);
    assert.strictEqual(res.type, "cancel");
  });
});

describe("Checking if the semantic analysis algorithm correctly categorises meeting titles", function () {
  it("should detect a work event", async () => {
    const title = "Cybersecurity conference";
    assert.strictEqual(await getCategory(title), "work");
  });

  it("should detect a social event", async () => {
    const title = "Lunch with friends";
    assert.strictEqual(await getCategory(title), "social");
  });

  it("should default to unknown if the category cannot be determined", async () => {
    const title = "Get together with Simon";
    assert.strictEqual(await getCategory(title), "unknown");
  });

  it("should default to throw an error if the title is empty", async () => {
    const title = "";
    assert.rejects(async () => {
      await getCategory(title);
    });
  });
});
