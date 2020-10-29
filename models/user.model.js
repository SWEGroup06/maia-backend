const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const GoogleAccountSchema = new Schema({
  email: String, // Email associated with Google Calendar account
  token: String, // Authorisation token per user for Google Calendar
});

const UserSchema = new Schema({
  email: {
    type: String,
    unique: true,
    required: true,
  },
  google: GoogleAccountSchema,
  constraints: [{startTime: String, endTime: String}],
});

const User = mongoose.model('User', UserSchema);
module.exports = User;
