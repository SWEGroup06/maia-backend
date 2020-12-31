const DEBUG = process.argv.includes("--dev") || false;
const AUTO = process.argv.includes("--auto") || false;

module.exports = {
  DEBUG,
  AUTO,
  BOT_TOKEN: DEBUG
    ? process.env.MAIA_BETA_BOT_TOKEN
    : process.env.MAIA_BOT_TOKEN,
  serverURL: DEBUG
    ? "http://localhost:3000"
    : "https://maia-server.herokuapp.com",
};
