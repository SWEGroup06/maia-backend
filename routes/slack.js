const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { DateTime } = require("luxon");
// eslint-disable-next-line new-cap
const router = express.Router();

const TIME = require("../lib/time.js");
const DATABASE = require("../lib/database.js");
const MEETINGS = require("../lib/meetings.js");
const EDIT_MEETING_VIEW = require("../blocks/edit-meeting-view.json");
const CONFIG = require("../config.js");

router.use("/actions", bodyParser.urlencoded({ extended: true }));

/* Submits a response to the slack bot
via the RESPONSE_URL provided by the payload */
const submitResponse = async function (payload, obj) {
  const res = await axios.post(payload.response_url, obj, {
    headers: {
      "Content-type": "application/json",
    },
  });
  if (res.data.error) {
    console.error("Slack API Error:", res.data);
    throw new Error("Slack API Error: " + res.data.error);
  }
};

/* Post a message to the channel via Slack API */
const postMessage = async function (channelId, text) {
  const res = await axios.post(
    "https://slack.com/api/chat.postMessage",
    {
      channel: channelId,
      text: text,
    },
    {
      headers: {
        "Content-type": "application/json",
        Authorization: `Bearer ${CONFIG.BOT_TOKEN}`,
      },
    }
  );
  if (res.data.error) {
    console.error("Slack API Error:", res.data);
    throw new Error("Slack API Error: " + res.data.error);
  }
};

/* Open a Modal View on the Slack App via Slack API */
const openView = async function (triggerId) {
  const res = await axios.post(
    "https://slack.com/api/views.open",
    {
      trigger_id: triggerId,
      view: EDIT_MEETING_VIEW,
    },
    {
      headers: {
        "Content-type": "application/json",
        Authorization: `Bearer ${CONFIG.BOT_TOKEN}`,
      },
    }
  );
  if (res.data.error) {
    console.error("Slack API Error:", res.data);
    throw new Error("Slack API Error: " + res.data.error);
  }
};

let channelId = null;
let eventIdToBeEdited = null;

const actionHandlers = {
  /**
   * Function that handles when the reschedule button is clicked
   *
   * @param {object} payload - The JSON provided by Slack from the Block Kit UI
   * @param {object} action - The action that has taken place on the UI
   * @return {object} - Returns null if it succeeds or error otherwise
   */
  reschedule_button: async function (payload, action) {
    try {
      if (!payload.state) {
        return "Please select a meeting";
      }
      const rescheduleOptions = payload.state.values.reschedule_options;
      const meetingDetails = decode(
        rescheduleOptions.meeting_select.selected_option.value
      );
      const meetingName = meetingDetails[0];
      const meetingStart = meetingDetails[1];
      const googleEmail = await DATABASE.getGoogleEmailFromSlackId(
        payload.user.id
      );
      let newSlot;
      if (
        rescheduleOptions.startDate.selected_date &&
        rescheduleOptions.endDate.selected_date
      ) {
        const newStartDate = new Date(
          rescheduleOptions.startDate.selected_date
        ).toISOString();
        const newEndDate = new Date(
          rescheduleOptions.endDate.selected_date
        ).toISOString();
        newSlot = await MEETINGS.reschedule(
          meetingStart,
          null,
          googleEmail,
          newStartDate,
          newEndDate
        );
      } else {
        newSlot = await MEETINGS.reschedule(
          meetingStart,
          null,
          googleEmail,
          null,
          null
        );
      }
      if (newSlot) {
        const startDateTime = DateTime.fromISO(newSlot.start);
        const endDateTime = DateTime.fromISO(newSlot.end);
        const date = startDateTime.toLocaleString(DateTime.DATE_SHORT);
        const startTime = startDateTime.toLocaleString(DateTime.TIME_24_SIMPLE);
        const endTime = endDateTime.toLocaleString(DateTime.TIME_24_SIMPLE);
        const text =
          "Okay, cool! :thumbsup::skin-tone-3: Rescheduled " +
          meetingName +
          " to " +
          date +
          " from " +
          startTime +
          " to " +
          endTime;
        await submitResponse(payload, { text });
      }
      return;
    } catch (error) {
      return error.toString();
    }
  },

  /**
   * A function handling the backend of the UI for setting constraints
   *
   * @param {object} payload - The JSON provided by Slack from the Block Kit UI
   * @param {object} action - The action that has taken place on the UI
   * @return {object} - Returns null if it succeeds or error otherwise
   */
  constraints: async function (payload, action) {
    try {
      // Parse state
      if (!payload.state) return "Please select a day.";
      const constraints = payload.state.values.constraints;
      const day = parseInt(constraints.day.selected_option.value);
      const startTime = new Date(
        `1 Jan 1970 ${constraints.start_time.selected_time}`
      ).toISOString();
      const endTime = new Date(
        `1 Jan 1970 ${constraints.end_time.selected_time}`
      ).toISOString();

      if (startTime === "Invalid Date" || endTime === "Invalid Date") {
        return "Invalid Time";
      }

      // Dont update if the input is not the submit button
      if (action.action_id !== "submit") return;

      // Set constraint
      const googleEmail = await DATABASE.getGoogleEmailFromSlackId(
        payload.user.id
      );
      await DATABASE.setConstraintForDayFromGoogleEmail(
        googleEmail,
        startTime,
        endTime,
        day
      );

      // Send response
      await submitResponse(payload, {
        text: "Okay, cool! :thumbsup::skin-tone-3: I'll keep this in mind.",
      });

      return;
    } catch (error) {
      return error.toString();
    }
  },

  /**
   * The function handling the logout button
   *
   * @param {object} payload - The JSON provided by Slack from the Block Kit UI
   * @param {object} action - The action that has taken place on the UI
   * @return {object} - Returns null if it succeeds or error otherwise
   */
  logout: async function (payload, action) {
    try {
      const slackEmail = JSON.parse(action.action_id);
      if (await DATABASE.userExists(slackEmail)) {
        const googleEmail = await DATABASE.getGoogleEmailFromSlackEmail(
          slackEmail
        );
        await DATABASE.deleteUser(googleEmail);
        await submitResponse(payload, {
          text: `*Sign out with ${googleEmail} was successful*`,
        });
      } else {
        console.error(
          `SLACK logout Error: Account with email ${googleEmail} does not exist.`
        );
        await submitResponse(payload, {
          text: `*Account with email ${googleEmail} does not exist.*`,
        });
      }
      return;
    } catch (error) {
      return error.toString();
    }
  },

  /**
   * The function handling the edit and cancel buttons for confirmation
   *
   * @param {object} payload - The JSON provided by Slack from the Block Kit UI
   * @param {object} action - The action that has taken place on the UI
   * @return {object} - Returns null if it succeeds or error otherwise
   */
  confirm: async function (payload, action) {
    try {
      // Save the channel id
      channelId = payload.channel.id;
      const eventId = action.value;
      if (action.action_id === "cancel") {
        const email = await DATABASE.getGoogleEmailFromSlackId(payload.user.id);
        await MEETINGS.cancelEvent(email, eventId);
        const text = "Your meeting booking has been cancelled";
        await submitResponse(payload, { text });
      } else if (action.action_id === "edit") {
        eventIdToBeEdited = eventId;
        await openView(payload.trigger_id);
      }
    } catch (error) {
      return error.toString();
    }
  },

  /**
   * Function that handles when the submit button is clicked on the modal view for edit details
   *
   * @param {object} payload - The JSON payload provided by Slack Block Kit UI
   * @param {object} action - The action that has been performed on the UI
   * @param {object} res - the response object which tells the function where to send the response
   * @return {object} - Returns null if it succeeds or error otherwise
   */
  viewSubmission: async function (payload, action, res) {
    try {
      const values = payload.view.state.values;
      const name = values.name["name-action"].value;
      const date = values.date["datepicker-action"].selected_date;
      const startTime = values.startTime["timepicker-action"].selected_time;
      const endTime = values.endTime["timepicker-action"].selected_time;
      const email = await DATABASE.getGoogleEmailFromSlackId(payload.user.id);
      await MEETINGS.rescheduleToSpecificDateTime(
        email,
        name,
        date,
        startTime,
        endTime,
        eventIdToBeEdited
      );
      res.send();
      const text = `No problem :+1::skin-tone-3:, 
        ${name ? `I've changed '${name}'` : "I've moved your event"} to 
        ${DateTime.fromISO(date).toLocaleString(DateTime.DATE_SHORT)}, from 
        ${startTime} to ${endTime}`;
      await postMessage(channelId, text);
    } catch (error) {
      return error.toString();
    }
  },
};

// Handles Block-kit UI actions
router.post("/actions", async function (req, res) {
  const payload = JSON.parse(req.body.payload);

  let handler = null;
  let action = null;

  if (!payload) {
    res.sendStatus(200);
    return;
  }

  if (payload.type === "view_submission") {
    handler = actionHandlers["viewSubmission"];
  } else if (payload.type === "block_actions") {
    if (!payload.actions || !payload.actions[0]) {
      res.sendStatus(200);
      return;
    }
    // Delegate specific tasks to action handler
    action = payload.actions[0];
    handler = actionHandlers[action.block_id];
  }
  if (handler) {
    const error = await handler(payload, action, res);
    if (error) {
      console.error("REST actions Error: " + error);
      await submitResponse(payload, {
        response_type: "ephemeral",
        replace_original: false,
        text: error,
      });
    } else {
      // Send status 200 with an empty body
      res.send();
    }
  } else {
    res.sendStatus(200);
  }
});

// Post request for getting all meetings for the dropdown
router.post("/actions/meeting_options", async function (req, res) {
  const payload = JSON.parse(req.body.payload);
  const meetingOptions = { options: [] };
  if (payload && payload.type === "block_suggestion") {
    if (payload.action_id === "meeting_select") {
      const googleEmail = await DATABASE.getGoogleEmailFromSlackId(
        payload.user.id
      );
      const meetings = await MEETINGS.getMeetings(googleEmail);
      if (!meetings) {
        return;
      }
      for (let i = 0; i < meetings.length; i++) {
        const name = meetings[i][0];
        const meetingName = name.substring(0, Math.min(18, name.length));
        const meetingStart = meetings[i][1];
        const startDateTime = DateTime.fromISO(meetingStart);
        const meetingEnd = meetings[i][2];
        const endDateTime = DateTime.fromISO(meetingEnd);
        const startTime = startDateTime.toLocaleString(DateTime.TIME_24_SIMPLE);
        const endTime = endDateTime.toLocaleString(DateTime.TIME_24_SIMPLE);
        const weekDay = TIME.getDayOfWeekFromInt(startDateTime.weekday);
        const meetingDetails = `${meetingName}|${meetingStart}|${meetingEnd}`;
        meetingOptions.options.push({
          text: {
            type: "plain_text",
            text: `${meetingName} | ${weekDay} ${startTime} - ${endTime}`,
          },
          value: meetingDetails,
        });
      }
    }
  }
  res.json(meetingOptions);
});

/**
 * @param {number} value The string to be decoded
 * @return {number} The decoded string split at '|' characters
 */
function decode(value) {
  const meetingDetails = value.split("|");
  return meetingDetails;
}

module.exports = router;
