
const fs = require('fs');
const ENV = fs.existsSync('./.env.json') ? require('./.env.json') : process.env;

module.exports = {
  serverURL: 'https://maia-server.herokuapp.com',

  CLIENT_ID: ENV.CLIENT_ID,
  CLIENT_SECRET: ENV.CLIENT_SECRET,
};
