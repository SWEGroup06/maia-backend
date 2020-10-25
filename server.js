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

DATABASE.connect(process.env.MONGO_URI).then(function() {
  app.listen(PORT, () => {
    console.log(`REST API Server hosted on: http://localhost:${PORT}`);
  });
});
