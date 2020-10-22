const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UserSchema = new Schema({
  userID: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  token: {
    type: String,
  },
});

const User = mongoose.model('User', UserSchema);
module.exports = User;
