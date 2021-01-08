require("dotenv").config();

const GOOGLE = require("./lib/google.js");
const googleEmail = process.env.TEST_ACCOUNT_EMAIL;

console.log({ url: GOOGLE.generateAuthUrl({ googleEmail }) });
