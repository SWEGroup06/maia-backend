const express = require('express')
const app = express()

// require('dotenv').config();

const port = 3000;

const routes = require('./routes');
app.use('/', routes)

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})