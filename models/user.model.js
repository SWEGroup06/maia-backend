const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const GoogleAccountSchema = new Schema({
  email: String, // Email associated with Google Calendar account
  token: String, // Authorisation token per user for Google Calendar
});

const SlackAccountSchema = new Schema({
  id: String, // Email associated with Google Calendar account
});

const UserSchema = new Schema({
  email: {
    type: String,
    unique: true,
    required: true,
  },
  slack: SlackAccountSchema,
  google: GoogleAccountSchema,
  constraints: [[{startTime: String, endTime: String}]],
  frequencies: [{histFreq: [[Number]], timestamp: String}],
});

const User = mongoose.model('User', UserSchema);
module.exports = User;
