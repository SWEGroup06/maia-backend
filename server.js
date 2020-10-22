const express = require('express')
const routesRouter = require('./routes/route');
const mongoose = require('mongoose');

const app = express()

const port = process.env.PORT || "3000";

app.use('/', routesRouter)

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})