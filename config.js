const DEBUG = process.argv.includes('--dev') || false;
const AUTO = process.argv.includes('--auto') || false;

module.exports = {
  DEBUG,
  AUTO,
  serverURL: DEBUG ? 'http://localhost:3000' : 'https://maia-server.herokuapp.com',
};
