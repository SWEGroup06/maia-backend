const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UserSchema = new Schema({
  email: {
    type: String,
    unique: true,
    required: true,
  },
  /* token: Authorisation token per user for Google Calendar. */
  token: {
    type: String,
    required: true,
  },
  /* TODO: constraints: ... */
  constraints: [{startTime: String, endTime: String}],
});

const User = mongoose.model('User', UserSchema);
module.exports = User;
