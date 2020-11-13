const DEBUG = process.argv.includes('--dev') || false;

module.exports = {
  DEBUG,
  serverURL: DEBUG ? 'http://localhost:3000' : 'https://maia-server.herokuapp.com',
};
