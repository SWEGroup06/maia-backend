const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const GoogleAccountSchema = new Schema({
  email: { type: String, unique: true, required: true }, // Email associated with Google Calendar account
  token: { type: String, required: true }, // Authorisation token per user for Google Calendar
});

const SlackAccountSchema = new Schema({
  id: { type: String }, // ID associated with Slack account
  email: { type: String, unique: true }, // Email associated with Slack account
});

const SchedulingPreferencesSchema = new Schema({
  minBreakLength: { type: Number }, // Minimum length of a break a user wants.
  autoReschedulingInterval: { type: Number }, // Minimum time before the auto-rescheduler should acknowledge event.
  clustering: { type: Boolean }, // Whether the user prefers clustering of events or not.
});

const UserSchema = new Schema({
  google: GoogleAccountSchema,
  slack: SlackAccountSchema,
  schedulingPreferences: SchedulingPreferencesSchema,
  constraints: [[{ startTime: String, endTime: String }]],
  frequencies: [{ histFreq: [[Number]], timestamp: String }],
});

const User = mongoose.model("User", UserSchema);
module.exports = User;
