const express = require('express');
const routes = require('./routes');

const app = express();

const port = process.env.PORT || '3000';

app.use('/', routes);

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
