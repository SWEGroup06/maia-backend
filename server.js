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

const routes = ['auth', 'api', 'slack', 'nlp'];
routes.forEach((name) => app.use(`/${name}`, require(`./routes/${name}.js`)));

// ROOT PATH
app.get('/', function(_, res) {
  res.send('This is the REST API for Maia AI calendar assistant');
});

//Routes for accepting and rejecting automatic reschedule suggestions
const GOOGLE = require('./lib/google.js');
const PARSER = require('body-parser');
app.use(PARSER.urlencoded({ extended: true }));
app.use(PARSER.json());

app.route('/automatic/reschedule/accept')
    .get(async function(req, res) {
        /*
        // Get the event
        const email = req.query.email;
        const fromStartDate = req.query.fromStart;
        const fromEndDate = req.query.fromEnd;

        const token = await DATABASE.getToken(email);
        const event = await GOOGLE.getEvents(token, fromStartDate, fromEndDate);

        // Reschedule the event
        const toStartTime = req.query.toStart;
        const toEndTime = req.query.toEnd;
        await GOOGLE.updateMeeting(token, event[0], toStartTime, toEndTime);*/
        res.send('reschedule acceptance page');
        console.log('reschedule acceptance page');
        //console.log(req.query.email);
        //console.log(req.query.fromStart);
        //console.log(req.query.fromEnd);
        //console.log(req.query.toStart);
        //console.log(req.query.toEnd);
    })
app.route('/automatic/reschedule/reject')
    .get(async function(req, res) {
        // Display rejection page
        res.send('reschedule rejection page');
        console.log("reschedule rejection page")
    })

// Establish database connection
DATABASE.getDatabaseConnection().then(() => {
  // Start REST Server
  app.listen(PORT, () => {
    console.log(`REST API Server hosted on: ${CONFIG.serverURL}${CONFIG.DEBUG ? `:${PORT}` : ''}`);
  });

  // Start AUTOMATION
  console.log(`AUTOMATION started`);
  AUTOMATION.start(INTERVAL);
}).catch((err) => { // mongoose connection error will be handled here
  console.error('App starting error:', err.stack);
});
