const express = require('express');
const router = express.Router();

const IMAP = require('../lib/imap.js');
IMAP.init().then(() => {
  // Gmail Pub/Sub callback
  router.post('/email', async function(req, res) {
    IMAP.getLatestEmail().then(console.log).catch(console.error);
    res.sendStatus(200);
  });
}).catch(console.error);

module.exports = router;
