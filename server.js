// Load environment variables
require('dotenv').config();

const express = require('express');
const routes = require('./api/routes.js');

const DATABASE = require('./api/database.js');

// Setup REST Server
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/success', express.static('public'));
app.use('/', routes);

/**
 * If the database connection is successfully established, the server will run.
 */
DATABASE.getDatabaseConnection().then(() => {
  app.listen(PORT, () => {
    console.log(`REST API Server hosted on: http://localhost:${PORT}`);
  });
}).catch((err) => { // mongoose connection error will be handled here
  console.error('App starting error:', err.stack);
});
