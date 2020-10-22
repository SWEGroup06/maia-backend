const express = require('express')
const routesRouter = require('./routes/route');
const usersRouter = require('./routes/users');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

require('dotenv').config();
const port = process.env.PORT || 3000;

const mongo_uri = process.env.MONGO_URI;
mongoose.connect(mongo_uri, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });

app.use('/', routesRouter);
app.use('/addUser', usersRouter);

const connection = mongoose.connection;
connection.once('open', () => {
  console.log("MongoDB connection established");
})


app.listen(port, () => {
  console.log(`REST API Server hosted on: http://localhost:${port}`);
});
