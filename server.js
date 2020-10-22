const express = require('express');
const routesRouter = require('./routes/route');
const usersRouter = require('./routes/users');
const mongoose = require('mongoose');

// Load environment variables
require('dotenv').config();

// Setup REST Server
const app = express();
app.use(express.json());

app.use('/', routesRouter);
app.use('/addUser', usersRouter);

const PORT = process.env.PORT || 3000;
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
