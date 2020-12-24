const express = require('express');
const router = express.Router();

// Determines which command the user wants
router.post('/email', async function(req, res) {
  console.log(req, res);
  res.sendStatus(200);
});

module.exports = router;
