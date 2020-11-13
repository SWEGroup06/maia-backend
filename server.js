// Load environment variables
require('dotenv').config();

const express = require('express');

const DATABASE = require('./lib/database.js');
const AUTOMATION = require('./lib/automation.js');
const CONFIG = require('./config.js');

// Setup REST Server
const app = express();
const PORT = process.env.PORT || 3000;

// AUTOMATION consts
const INTERVAL = 10e3;

// Configure routes
app.use(express.json());

const routes = ['auth', 'api', 'slack', 'nlp', 'auto'];
routes.forEach((name) => app.use(`/${name}`, require(`./routes/${name}.js`)));

// ROOT PATH
app.get('/', function(_, res) {
  res.send('This is the REST API for Maia AI calendar assistant');
});


// Establish database connection
DATABASE.getDatabaseConnection().then(() => {
  // Start REST Server
  app.listen(PORT, () => {
    console.log(`REST API Server hosted on: ${CONFIG.serverURL}`);
  });

  if (CONFIG.AUTO) {
    // Start AUTOMATION
    console.log(`AUTOMATION started`);
    AUTOMATION.start(INTERVAL);
  }
}).catch((err) => { // mongoose connection error will be handled here
  console.error('App starting error:', err.stack);
});
