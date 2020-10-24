const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UserSchema = new Schema({
  /* id: Compound primary key object consisting of userID and teamID. */
  id: {
    type: Object,
    required: true,
    unique: true,
    userID: String,
    teamID: String,
  },
  /* token: Authorisation token per user for Google Calendar. */
  token: {
    type: String,
    required: true,
  },
  /* TODO: constraints: ... */
  constraints: {
    type: Array,
  },
});

const User = mongoose.model('User', UserSchema);
module.exports = User;
