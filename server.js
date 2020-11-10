// Load environment variables
require('dotenv').config();

const express = require('express');

const DATABASE = require('./lib/database.js');
const CONFIG = require('./config.js');

// Setup REST Server
const app = express();
const PORT = process.env.PORT || 3000;

// Configure routes
app.use(express.json());

const routes = ['auth', 'api', 'slack', 'nlp'];
routes.forEach((name) => app.use(`/${name}`, require(`./routes/${name}.js`)));

// ROOT PATH
app.get('/', function(_, res) {
  res.send('This is the REST API for Maia AI calendar assistant');
});

// Start REST Server once database connection established
DATABASE.getDatabaseConnection().then(() => {
  app.listen(PORT, () => {
    console.log(`REST API Server hosted on: ${CONFIG.serverURL}${CONFIG.DEBUG ? `:${PORT}` : ''}`);
  });
}).catch((err) => { // mongoose connection error will be handled here
  console.error('App starting error:', err.stack);
});
