const express = require('express');
const routes = require('./api/routes.js');
const mongoose = require('mongoose');

// Load environment variables
require('dotenv').config();

// Setup REST Server
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/', routes);

app.listen(PORT, () => {
  console.log(`REST API Server hosted on: http://localhost:${PORT}`);
});

// Setup Mongo DB
mongoose.connect(process.env.MONGO_URI,
    {useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true});

const connection = mongoose.connection;
connection.once('open', () => {
  console.log('MongoDB connected');
});
