const DEBUG = process.argv.includes('--dev') || false;

module.exports = {
  DEBUG,
  serverURL: DEBUG ? 'http://localhost' : 'https://maia-server.herokuapp.com',
};
