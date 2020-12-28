const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const GoogleAccountSchema = new Schema({
  email: {type: String, unique: true, required: true}, // Email associated with Google Calendar account
  token: {type: String, required: true}, // Authorisation token per user for Google Calendar
});

const SlackAccountSchema = new Schema({
  id: {type: String}, // ID associated with Slack account
  email: {type: String, unique: true}, // Email associated with Slack account
});

const UserSchema = new Schema({
  google: GoogleAccountSchema,
  slack: SlackAccountSchema,
  constraints: [[{startTime: String, endTime: String}]],
  frequencies: [{histFreq: [[Number]], timestamp: String}],
});

const User = mongoose.model('User', UserSchema);
module.exports = User;
