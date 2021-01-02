const express = require("express");
const router = express.Router();

const DIALOGFLOW = require("../lib/dialogflow.js");

// Determines which command the user wants
router.get("/", async function (req, res) {
  const text = JSON.parse(decodeURIComponent(req.query.text));
  try {
    res.json(await DIALOGFLOW.sendQuery(text));
  } catch (error) {
    console.error(error);
    res.send({ error: error.toString() });
  }
});

module.exports = router;
