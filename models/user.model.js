const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UserSchema = new Schema({
  id: {
    userID: {
      type: String,
      required: true,
    },
    teamID: {
      type: String,
      required: true,
    },
    required: true,
    unique: true,
  },
  token: {
    type: String,
    required: true,
  },
});

const User = mongoose.model('User', UserSchema);
module.exports = User;
